import spawn from "cross-spawn";
import { getSanitizedEnv } from "./env.js";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function execCommand(
  command: string,
  args: string[],
  options: { cwd: string; timeout: number; signal?: AbortSignal; maxBuffer?: number },
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: getSanitizedEnv(),
    });

    // Use Buffer chunks for efficient stdout collection
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;
    const maxBuffer = options.maxBuffer ?? 10 * 1024 * 1024;
    let stdoutLen = 0;
    let stderrLen = 0;

    proc.stdout!.on("data", (data: Buffer) => {
      stdoutChunks.push(data);
      stdoutLen += data.length;
      if (stdoutLen > maxBuffer) {
        proc.kill();
        if (!settled) {
          settled = true;
          resolve({
            stdout: Buffer.concat(stdoutChunks).toString("utf-8").slice(0, maxBuffer),
            stderr: Buffer.concat(stderrChunks).toString("utf-8"),
            exitCode: -1,
          });
        }
      }
    });

    proc.stderr!.on("data", (data: Buffer) => {
      stderrChunks.push(data);
      stderrLen += data.length;
      // Cap stderr at 1MB, keeping the last 512KB
      if (stderrLen > 1024 * 1024) {
        const combined = Buffer.concat(stderrChunks);
        const start = Math.max(0, combined.length - 512 * 1024);
        stderrChunks.length = 0;
        stderrChunks.push(combined.subarray(start));
        stderrLen = stderrChunks[0].length;
      }
    });

    const timeoutId = setTimeout(() => {
      proc.kill();
      if (!settled) {
        settled = true;
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
          stderr: Buffer.concat(stderrChunks).toString("utf-8"),
          exitCode: -1,
        });
      }
    }, options.timeout);

    proc.on("close", (code) => {
      clearTimeout(timeoutId);
      if (!settled) {
        settled = true;
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
          stderr: Buffer.concat(stderrChunks).toString("utf-8"),
          exitCode: code ?? 0,
        });
      }
    });

    proc.on("error", (_err) => {
      clearTimeout(timeoutId);
      if (!settled) {
        settled = true;
        resolve({
          stdout: "",
          stderr: _err.message,
          exitCode: -1,
        });
      }
    });

    if (options.signal) {
      const abortHandler = () => {
        proc.kill();
        if (!settled) {
          settled = true;
          resolve({
            stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
            stderr: Buffer.concat(stderrChunks).toString("utf-8"),
            exitCode: -1,
          });
        }
      };
      options.signal.addEventListener("abort", abortHandler, { once: true });
      proc.on("close", () => {
        options.signal?.removeEventListener("abort", abortHandler);
      });
      proc.on("error", () => {
        options.signal?.removeEventListener("abort", abortHandler);
      });
    }
  });
}
