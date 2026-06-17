/**
 * Request-body validation middleware backed by zod.
 *
 * Every route that accepts input runs through here, so untrusted client data is
 * parsed and narrowed before any handler — or any LLM — ever sees it. The
 * validated value is stored on `res.locals.body` for the handler to consume.
 */
import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: result.error.flatten().fieldErrors,
      });
      return;
    }
    res.locals.body = result.data;
    next();
  };
}

/** Type-safe accessor for the validated body inside a handler. */
export function body<T>(res: Response): T {
  return res.locals.body as T;
}
