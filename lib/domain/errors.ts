import { ZodError } from "zod";

export class AppError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export function asAppError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }

  // Zod validation errors — don't expose schema field paths to the client
  if (error instanceof ZodError) {
    const fieldNames = error.errors
      .map((e) => e.path[e.path.length - 1])
      .filter(Boolean)
      .join(", ");
    const message = fieldNames
      ? `Invalid input: ${fieldNames}`
      : "Invalid input.";
    return new AppError(message, 400, "VALIDATION_ERROR");
  }

  if (error instanceof Error) {
    return new AppError(error.message, 500, "UNEXPECTED_ERROR");
  }

  return new AppError("Unexpected error", 500, "UNEXPECTED_ERROR");
}
