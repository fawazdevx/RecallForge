
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


export function body<T>(res: Response): T {
  return res.locals.body as T;
}
