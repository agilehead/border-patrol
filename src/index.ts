#!/usr/bin/env node

import Koa = require("koa");
import session = require("koa-session");
import mount = require("koa-mount");
import Router = require("koa-router");
import bodyParser = require("koa-bodyparser");
import { handleProviderCallback } from "./api/oauth";
import { join } from "path";
import * as db from "./db";
import * as jwt from "./utils/jwt";
import * as config from "./config";
import { authenticate } from "./api/authenticate";
import { IAppConfig, IJwtConfig } from "./types";
import { getUserIdAvailability } from "./api/userIds";
import { createUser } from "./api/users";
import { createKeyValuePair } from "./api/me";
import { login } from "./api/localAccount";

const grant = require("grant-koa");

export async function init(configDir: string) {
  const oauthConfig = require(join(configDir, "oauth.js"));
  const dbConfig = require(join(configDir, "pg.js"));
  const jwtConfig: IJwtConfig = require(join(configDir, "jwt.js"));
  const appConfig: IAppConfig = require(join(configDir, "app.js"));

  // Init utils
  db.init(dbConfig);
  jwt.init(jwtConfig);
  config.init(appConfig);

  // Set up routes
  const router = new Router();

  /* Entry point for all auth services */
  appConfig.enabledProviders.forEach((service) => {
    router.get(`/authenticate/${service}`, authenticate(service));
  });

  /* OAuth services need a callback */
  appConfig.enabledProviders.forEach((oauthService) =>
    router.get(
      `/oauth/token/${oauthService}`,
      async (ctx: Router.RouterContext) =>
        await handleProviderCallback(ctx, oauthService)
    )
  );

  /* Check if a user-id is available */
  router.get(`/user-ids/:userId`, getUserIdAvailability);

  /* Create a new user. */
  router.post(`/users`, createUser);

  /* Add a key value pair for a user */
  router.post(`/me/kvstore`, createKeyValuePair);

  if (appConfig.enablePasswordAuth) {
    router.post("/login", login);
  }

  for (const key in oauthConfig) {
    if (key !== "defaults") {
      oauthConfig[key].callback = `/oauth/token/${key}`;
    }
  }

  // Start app
  var app = new Koa();
  app.use(bodyParser());
  app.keys = appConfig.sessionKeys.split(",");
  app.use(session(app));
  app.use(mount(grant(oauthConfig)));
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}

if (require.main === module) {
  if (!process.env.PORT) {
    throw new Error("The port should be specified in process.env.PORT");
  }

  if (!process.env.CONFIG_DIR) {
    throw new Error(
      "The configuration directory should be specified in process.env.CONFIG_DIR"
    );
  }

  const port: number = parseInt(process.env.PORT);

  init(process.env.CONFIG_DIR).then((app) => {
    app.listen(port);
    console.log(`listening on port ${port}`);
  });
}
