import { vi } from "vitest";

/**
 * Creates reusable mock objects for command tests.
 *
 * Returns a `registeredHandlers` Map (for capturing registerCommand calls)
 * and a `mockExecutePreamble` function (for mocking executePreamble).
 *
 * NOTE: This function is intended to be called inside `vi.hoisted()` in test
 * files so that the returned values are available to `vi.mock()` factories
 * (which are hoisted to the top of the file by Vitest).
 *
 * @example
 * ```typescript
 * const { registeredHandlers, mockExecutePreamble } = vi.hoisted(() =>
 *   createCommandMocks(),
 * );
 * ```
 */
export function createCommandMocks() {
  const registeredHandlers = new Map<string, Function>();
  const mockExecutePreamble = vi.fn();
  return { registeredHandlers, mockExecutePreamble };
}
