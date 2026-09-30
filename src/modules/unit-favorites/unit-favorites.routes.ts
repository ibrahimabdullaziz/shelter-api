import express from "express";
import { authGuard } from "../../common/middleware/authGuard";
import { roleGuard } from "../../common/middleware/roleGuard";
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from "./unit-favorites.controller";

const unitFavoriteRoutes = express.Router({ mergeParams: true });
const unitFavoriteGetRoutes = express.Router({ mergeParams: true });

unitFavoriteGetRoutes.get("/", authGuard, listFavorites);
unitFavoriteRoutes.post("/", authGuard, roleGuard("GUEST"), addFavorite);
unitFavoriteRoutes.delete("/", authGuard, roleGuard("GUEST"), removeFavorite);

export { unitFavoriteRoutes, unitFavoriteGetRoutes };
