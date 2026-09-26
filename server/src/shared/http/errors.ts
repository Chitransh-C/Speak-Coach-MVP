export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toErrorPayload(err: unknown): {
  statusCode: number;
  body: { error: { code: string; message: string } };
} {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      body: { error: { code: err.code, message: err.message } },
    };
  }
  console.error(err);
  return {
    statusCode: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } },
  };
}
