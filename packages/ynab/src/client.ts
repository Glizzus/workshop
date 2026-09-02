import { YNAB_API_BASE_URL } from "./constants.js";
import type {
  CategoriesData,
  CategoriesResponse,
  ErrorDetail,
  ErrorResponse,
  ExistingTransaction,
  PutTransactionWrapper,
  TransactionData,
  TransactionResponse,
  TransactionsData,
  TransactionsResponse,
} from "./types.js";

/** Options for {@link YNABClient.getTransactions}. */
export interface GetTransactionsOptions {
  /**
   * Only transactions on or after this date are included. ISO date, e.g.
   * "2016-12-30". YNAB defaults to one year ago when omitted.
   */
  since_date?: string;
}

/** Thrown when YNAB answers with a non-2xx status. */
export class YNABError extends Error {
  /** HTTP status of the failed response. */
  readonly status: number;
  /** YNAB's error body, when the response carried one. */
  readonly detail: ErrorDetail | undefined;

  constructor(status: number, detail: ErrorDetail | undefined) {
    super(
      detail ? `YNAB ${String(status)} ${detail.name}: ${detail.detail}` : `YNAB ${String(status)}`,
    );
    this.name = "YNABError";
    this.status = status;
    this.detail = detail;
  }
}

/** A thin client for the YNAB API, authenticated with a personal access token. */
export class YNABClient {
  readonly #token: string;

  constructor(token: string) {
    this.#token = token;
  }

  /**
   * GET /plans/{plan_id}/transactions. Returns the plan's transactions,
   * excluding pending ones, along with the server knowledge at the time.
   *
   * `planId` may be a plan id, "last-used", or "default".
   */
  async getTransactions(
    planId: string,
    options: GetTransactionsOptions = {},
  ): Promise<TransactionsData> {
    const url = new URL(`${YNAB_API_BASE_URL}/plans/${encodeURIComponent(planId)}/transactions`);
    if (options.since_date !== undefined) {
      url.searchParams.set("since_date", options.since_date);
    }

    const body = await this.#request<TransactionsResponse>("GET", url);
    return body.data;
  }

  /**
   * GET /plans/{plan_id}/categories. Returns all categories grouped by
   * category group. Amounts (assigned, activity, available, etc.) are specific
   * to the current plan month (UTC).
   *
   * `planId` may be a plan id, "last-used", or "default".
   */
  async getCategories(planId: string): Promise<CategoriesData> {
    const url = new URL(`${YNAB_API_BASE_URL}/plans/${encodeURIComponent(planId)}/categories`);

    const body = await this.#request<CategoriesResponse>("GET", url);
    return body.data;
  }

  /**
   * PUT /plans/{plan_id}/transactions/{transaction_id}. Updates a single
   * transaction; fields left out of `transaction` are unchanged.
   *
   * To split a transaction, send `category_id: null` together with
   * `subtransactions`. YNAB only accepts `subtransactions` when the transaction
   * is not already a split -- see {@link ExistingTransaction.subtransactions}.
   */
  async updateTransaction(
    planId: string,
    transactionId: string,
    transaction: ExistingTransaction,
  ): Promise<TransactionData> {
    const url = new URL(
      `${YNAB_API_BASE_URL}/plans/${encodeURIComponent(planId)}/transactions/${encodeURIComponent(transactionId)}`,
    );
    const wrapper: PutTransactionWrapper = { transaction };

    const body = await this.#request<TransactionResponse>("PUT", url, wrapper);
    return body.data;
  }

  async #request<T>(method: "GET" | "PUT", url: URL, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#token}`,
      Accept: "application/json",
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      throw new YNABError(response.status, await readErrorDetail(response));
    }

    return (await response.json()) as T;
  }
}

// Error bodies are JSON per the spec, but a proxy or outage can hand back HTML
// or nothing at all. The status is still worth throwing, so treat an unparsable
// body as "no detail" rather than masking the real failure with a SyntaxError.
async function readErrorDetail(response: Response): Promise<ErrorDetail | undefined> {
  try {
    const body = (await response.json()) as Partial<ErrorResponse>;
    return body.error;
  } catch {
    return undefined;
  }
}
