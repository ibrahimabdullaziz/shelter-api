import ApiError from "../../common/utils/ApiError";
import { favoriteServiceDependencies } from "./dependencies/favorites.dependencies";
export { favoriteServiceDependencies } from "./dependencies/favorites.dependencies";

export async function addFavoriteService(userId: string, unitId: string) {
  const unit = await favoriteServiceDependencies.prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit || unit.deletedAt || !unit.isActive) {
    throw new ApiError(404, "Unit is not available");
  }

  const favoriteItem =
    await favoriteServiceDependencies.prisma.unitFavorite.create({
      data: { userId, unitId },
    });

  if (!favoriteItem) {
    throw new ApiError(500, "Error in adding this unit to favorites");
  }

  return favoriteItem;
}

export async function removeFavoriteService(userId: string, unitId: string) {
  const deletedItem =
    await favoriteServiceDependencies.prisma.unitFavorite.delete({
      where: {
        unitId_userId: { unitId, userId },
      },
    });

  if (!deletedItem) {
    throw new ApiError(500, "Error in removing this unit from favorites");
  }

  return deletedItem;
}

export async function listFavoritesService(userId: string) {
  const units = await favoriteServiceDependencies.prisma.unitFavorite.findMany({
    where: { userId: userId },
    include: {
      unit: {
        select: {
          id: true,
          title: true,
          description: true,
          pricePerNight: true,
          maxGuests: true,
          isActive: true,
          deletedAt: true,
          cityId: true,
          currencyId: true,
          categoryId: true,
          photos: true,
        },
      },
    },
  });

  return units;
}

export const favoriteServices = {
  addFavoriteService,
  removeFavoriteService,
  listFavoritesService,
};
