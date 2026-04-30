export class AuthRequiredError extends Error {
  constructor(message = "Sign in is required.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export class BrandAccessError extends Error {
  constructor(message = "Brand not found.") {
    super(message);
    this.name = "BrandAccessError";
  }
}

export function authErrorStatus(error: unknown) {
  if (error instanceof AuthRequiredError) return 401;
  if (error instanceof BrandAccessError) return 404;
  return 500;
}
