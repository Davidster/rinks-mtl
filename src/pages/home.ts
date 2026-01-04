import { env } from "../env.js";

export function homePage(): string {
  return `
<!DOCTYPE html>
<h1>Welcome!</h1>
The Server is running on port ${env.PORT}
`;
}
