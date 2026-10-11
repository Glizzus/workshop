import { d2Runner, type RunResult, type Runner } from "./run.js";

/** Options for {@link D2.render}. */
export interface RenderOptions {
  /** `--layout`: dagre (d2's default), elk or tala. */
  layout?: string;
  /**
   * `--bundle=false`: leave remote icons and images as links instead of
   * fetching and inlining them, so rendering needs no network.
   */
  bundle?: boolean;
  /**
   * `--target`: the board to render. The empty string renders the root board
   * alone, which multi-board output formats such as ASCII need.
   */
  target?: string;
  /** Any further flags, passed through before the input path. */
  flags?: readonly string[];
}

/**
 * The d2 command line. The output format follows the output path's
 * extension: .svg, .png, .pdf, .pptx, .gif, or .txt for an ASCII render.
 */
export class D2 {
  readonly #run: Runner;

  constructor(options: { runner?: Runner } = {}) {
    this.#run = options.runner ?? d2Runner();
  }

  /** `d2 --version`, trimmed. */
  async version(): Promise<string> {
    return (await this.#run(["--version"])).stdout.trim();
  }

  /** `d2 fmt`: formats `file` in place. A non-zero exit is a parse error. */
  fmt(file: string): Promise<RunResult> {
    return this.#run(["fmt", file]);
  }

  /** Compiles `input` and writes it to `output`. A non-zero exit is a compile or render error. */
  render(input: string, output: string, options: RenderOptions = {}): Promise<RunResult> {
    const args = [...(options.flags ?? [])];
    if (options.layout !== undefined) args.push(`--layout=${options.layout}`);
    if (options.bundle !== undefined) args.push(`--bundle=${String(options.bundle)}`);
    if (options.target !== undefined) args.push(`--target=${options.target}`);
    return this.#run([...args, input, output]);
  }
}
