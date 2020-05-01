import { IRouterContext } from "koa-router";
import * as configModule from "../config";
import { authenticate } from "../domain/localAccount";
import { sign } from "../utils/jwt";
import { setCookie } from "../utils/cookie";

export async function login(ctx: IRouterContext) {
  const config = configModule.get();

  const { userId, password } = ctx.body;
  const isValidLogin = await authenticate(userId, password);

  if (isValidLogin) {
    const tokenData = {
      userId,
      providerUserId: userId,
      provider: "local",
    };
    const jwt = sign(tokenData);

    setCookie(ctx, "border-patrol-jwt", jwt);
    setCookie(ctx, "border-patrol-user-id", userId);
    setCookie(ctx, "border-patrol-domain", config.domain);

    ctx.body = {
      success: true,
      userId,
      domain: config.domain,
      jwt,
    };
  } else {
    ctx.body = {
      success: false,
    };
  }
}
