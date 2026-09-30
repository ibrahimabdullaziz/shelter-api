import { expect } from "chai";
import { afterEach, describe, it } from "mocha";
import sinon from "sinon";
import {
  favoriteServiceDependencies,
  addFavoriteService,
  listFavoritesService,
  removeFavoriteService,
} from "../../src/modules/unit-favorites/unit-favorites.service";
import {
  reviewServiceDependencies,
  createReviewService,
  getUnitReviewsService,
} from "../../src/modules/unit-reviews/unit-reviews.service";
import {
  unitPhotoServiceDependencies,
  uploadUnitPhotoService,
  deleteUnitPhotoService,
} from "../../src/modules/unit-photos/unit-photos.service";
import {
  otpServiceDependencies,
  generateOtp,
  verifyOtp,
} from "../../src/modules/otp/otp.service";
import {
  countryServiceDependencies,
  createCountryService,
  getAllCountriesService,
} from "../../src/modules/countries/countries.service";
import {
  cityServiceDependencies,
  createCityService,
  getAllCitiesService,
} from "../../src/modules/cities/city.service";
import {
  currencyServiceDependencies,
  createCurrencyService,
  getAllCurrencyService,
} from "../../src/modules/currencies/currency.service";
import {
  categoryServiceDependencies,
  createCategoryService,
  getAllCategoriesService,
} from "../../src/modules/categories/category.service";

const unit = { id: "unit-1", ownerId: "host-1" };
const photo = { id: "photo-1", unitId: "unit-1", publicId: "public-1" };

async function rejectsWithStatus(
  work: () => Promise<unknown>,
  statusCode: number,
) {
  try {
    await work();
    expect.fail("operation should reject");
  } catch (error) {
    expect(error).to.have.property("statusCode", statusCode);
  }
}

describe("supporting services", () => {
  afterEach(() => sinon.restore());

  describe("favorites", () => {
    it("adds, removes, and lists favorites", async () => {
      sinon
        .stub(favoriteServiceDependencies.prisma.unit, "findUnique")
        .resolves({ isActive: true, deletedAt: null });
      const create = sinon
        .stub(favoriteServiceDependencies.prisma.unitFavorite, "create")
        .resolves({ unitId: "unit-1" });
      const remove = sinon
        .stub(favoriteServiceDependencies.prisma.unitFavorite, "delete")
        .resolves({ unitId: "unit-1" });
      const findMany = sinon
        .stub(favoriteServiceDependencies.prisma.unitFavorite, "findMany")
        .resolves([unit]);

      await addFavoriteService("guest-1", "unit-1");
      await removeFavoriteService("guest-1", "unit-1");
      const result = await listFavoritesService("guest-1");

      expect(
        create.calledWith({ data: { userId: "guest-1", unitId: "unit-1" } }),
      ).to.equal(true);
      expect(
        remove.calledWith({
          where: { unitId_userId: { unitId: "unit-1", userId: "guest-1" } },
        }),
      ).to.equal(true);
      expect(
        findMany.calledWith({
          where: { userId: "guest-1" },
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
              },
            },
          },
        }),
      ).to.equal(true);
      expect(result).to.deep.equal([unit]);
    });

    it("rejects when adding or removing returns no record", async () => {
      sinon
        .stub(favoriteServiceDependencies.prisma.unit, "findUnique")
        .resolves({ isActive: true, deletedAt: null });
      sinon
        .stub(favoriteServiceDependencies.prisma.unitFavorite, "create")
        .resolves(null);
      await rejectsWithStatus(
        () => addFavoriteService("guest-1", "unit-1"),
        500,
      );

      sinon.restore();
      sinon
        .stub(favoriteServiceDependencies.prisma.unitFavorite, "delete")
        .resolves(null);
      await rejectsWithStatus(
        () => removeFavoriteService("guest-1", "unit-1"),
        500,
      );
    });

    it("rejects favorites for unavailable units", async () => {
      sinon
        .stub(favoriteServiceDependencies.prisma.unit, "findUnique")
        .resolves({ isActive: false, deletedAt: null });

      await rejectsWithStatus(
        () => addFavoriteService("guest-1", "unit-1"),
        404,
      );
    });
  });

  describe("reviews", () => {
    it("creates a review only after a completed booking", async () => {
      const findFirst = sinon
        .stub(reviewServiceDependencies.prisma.booking, "findFirst")
        .resolves({ id: "booking-1" });
      const create = sinon
        .stub(reviewServiceDependencies.prisma.unitReview, "create")
        .resolves({ id: "review-1" });

      const result = await createReviewService("guest-1", "unit-1", 5, "Great");

      expect(
        findFirst.calledWith({
          where: { guestId: "guest-1", unitId: "unit-1", status: "COMPLETED" },
        }),
      ).to.equal(true);
      expect(
        create.calledWith({
          data: {
            unitId: "unit-1",
            guestId: "guest-1",
            rating: 5,
            comment: "Great",
          },
        }),
      ).to.equal(true);
      expect(result).to.deep.equal({ id: "review-1" });
    });

    it("rejects reviews without a completed booking", async () => {
      sinon
        .stub(reviewServiceDependencies.prisma.booking, "findFirst")
        .resolves(null);
      await rejectsWithStatus(
        () => createReviewService("guest-1", "unit-1", 5, "Great"),
        403,
      );
    });

    it("returns reviews and the average rating", async () => {
      const findMany = sinon
        .stub(reviewServiceDependencies.prisma.unitReview, "findMany")
        .resolves([unit]);
      const aggregate = sinon
        .stub(reviewServiceDependencies.prisma.unitReview, "aggregate")
        .resolves({ _avg: { rating: 4 } });

      const result = await getUnitReviewsService("unit-1");

      expect(
        findMany.calledWith({
          where: { unitId: "unit-1" },
          include: { unit: true },
        }),
      ).to.equal(true);
      expect(
        aggregate.calledWith({
          _avg: { rating: true },
          where: { unitId: "unit-1" },
        }),
      ).to.equal(true);
      expect(result).to.deep.equal({
        reviews: [unit],
        avgRating: { _avg: { rating: 4 } },
      });
    });
  });

  describe("unit photos", () => {
    it("uploads a photo for the unit owner", async () => {
      sinon
        .stub(unitPhotoServiceDependencies.prisma.unit, "findUnique")
        .resolves(unit);
      const stream = { end: sinon.stub() };
      const upload = sinon
        .stub(unitPhotoServiceDependencies.cloudinary.uploader, "upload_stream")
        .callsFake((_options, callback) => {
          (
            callback as (
              error: undefined,
              result: { secure_url: string; public_id: string },
            ) => void
          )(undefined, {
            secure_url: "https://photo",
            public_id: "public-1",
          });
          return stream;
        });
      const create = sinon
        .stub(unitPhotoServiceDependencies.prisma.unitPhoto, "create")
        .resolves(photo);

      const result = await uploadUnitPhotoService(
        "unit-1",
        "host-1",
        Buffer.from("data"),
      );

      expect(upload.calledOnce).to.equal(true);
      expect(stream.end.calledOnce).to.equal(true);
      expect(
        create.calledWith({
          data: {
            url: "https://photo",
            publicId: "public-1",
            unitId: "unit-1",
          },
        }),
      ).to.equal(true);
      expect(result).to.equal(photo);
    });

    it("preserves Cloudinary upload errors as useful errors", async () => {
      sinon
        .stub(unitPhotoServiceDependencies.prisma.unit, "findUnique")
        .resolves(unit);
      sinon
        .stub(unitPhotoServiceDependencies.cloudinary.uploader, "upload_stream")
        .callsFake((_options, callback) => {
          (
            callback as unknown as (
              error: { message: string },
              result: undefined,
            ) => void
          )({ message: "Invalid Signature" }, undefined);
          return { end: sinon.stub() };
        });

      try {
        await uploadUnitPhotoService("unit-1", "host-1", Buffer.from("data"));
        expect.fail("upload should reject");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal(
          "Cloudinary upload failed: Invalid Signature",
        );
      }
    });

    it("rejects photo uploads to deleted units", async () => {
      sinon
        .stub(unitPhotoServiceDependencies.prisma.unit, "findUnique")
        .resolves({ ...unit, deletedAt: new Date() });

      await rejectsWithStatus(
        () => uploadUnitPhotoService("unit-1", "host-1", Buffer.from("data")),
        404,
      );
    });

    it("rejects photo upload by a different owner", async () => {
      sinon
        .stub(unitPhotoServiceDependencies.prisma.unit, "findUnique")
        .resolves({ ...unit, ownerId: "other-host" });
      await rejectsWithStatus(
        () => uploadUnitPhotoService("unit-1", "host-1", Buffer.from("data")),
        403,
      );
    });

    it("destroys the cloud photo and database record", async () => {
      sinon
        .stub(unitPhotoServiceDependencies.prisma.unitPhoto, "findUnique")
        .resolves({ ...photo, unit });
      const destroy = sinon
        .stub(unitPhotoServiceDependencies.cloudinary.uploader, "destroy")
        .resolves({ result: "ok" });
      const remove = sinon
        .stub(unitPhotoServiceDependencies.prisma.unitPhoto, "delete")
        .resolves(photo);

      await deleteUnitPhotoService("photo-1", "host-1");

      expect(destroy.calledWith("public-1")).to.equal(true);
      expect(remove.calledWith({ where: { id: "photo-1" } })).to.equal(true);
    });
  });

  describe("OTP", () => {
    it("generates a secure six-digit OTP with a ten-minute expiry", async () => {
      const now = new Date("2026-09-12T10:00:00.000Z");
      sinon.stub(otpServiceDependencies, "now").returns(now);
      sinon.stub(otpServiceDependencies, "randomInt").returns(100000);
      const upsert = sinon
        .stub(otpServiceDependencies.prisma.otp, "upsert")
        .resolves({ code: "100000" });

      const result = await generateOtp("user@example.com", "VERIFY_EMAIL");
      const args = upsert.firstCall.args[0];

      expect(result).to.equal("100000");
      expect(args.create).to.include({
        email: "user@example.com",
        code: "100000",
        purpose: "VERIFY_EMAIL",
      });
      expect(args.create.expiresAt).to.deep.equal(
        new Date("2026-09-12T10:10:00.000Z"),
      );
    });

    it("verifies a valid OTP and marks it used", async () => {
      const now = new Date("2026-09-12T10:00:00.000Z");
      sinon.stub(otpServiceDependencies, "now").returns(now);
      const updateMany = sinon
        .stub(otpServiceDependencies.prisma.otp, "updateMany")
        .resolves({ count: 1 });

      expect(
        await verifyOtp("user@example.com", "100000", "VERIFY_EMAIL"),
      ).to.equal(true);
      expect(
        updateMany.calledWithMatch({
          where: {
            email: "user@example.com",
            code: "100000",
            purpose: "VERIFY_EMAIL",
          },
          data: { usedAt: now },
        }),
      ).to.equal(true);
    });

    it("rejects a missing or expired OTP", async () => {
      sinon
        .stub(otpServiceDependencies.prisma.otp, "updateMany")
        .resolves({ count: 0 });
      await rejectsWithStatus(
        () => verifyOtp("user@example.com", "bad", "VERIFY_EMAIL"),
        400,
      );
    });
  });

  for (const catalog of [
    [
      "countries",
      countryServiceDependencies,
      getAllCountriesService,
      createCountryService,
      "country",
    ],
    [
      "cities",
      cityServiceDependencies,
      getAllCitiesService,
      createCityService,
      "city",
    ],
    [
      "currencies",
      currencyServiceDependencies,
      getAllCurrencyService,
      createCurrencyService,
      "currency",
    ],
    [
      "categories",
      categoryServiceDependencies,
      getAllCategoriesService,
      createCategoryService,
      "unitCategory",
    ],
  ] as const) {
    it(`supports ${catalog[0]} CRUD service operations`, async () => {
      const delegate = (catalog[1].prisma as any)[catalog[4]];
      const findMany = sinon
        .stub(delegate, "findMany")
        .resolves([{ id: `${catalog[0]}-1` }]);
      const create = sinon
        .stub(delegate, "create")
        .resolves({ id: `${catalog[0]}-1` });
      const data = { name: `${catalog[0]} item` };

      expect(await catalog[2]()).to.deep.equal([{ id: `${catalog[0]}-1` }]);
      expect(await catalog[3](data as never)).to.deep.equal({
        id: `${catalog[0]}-1`,
      });
      expect(findMany.calledWith({})).to.equal(true);
      expect(create.calledWith({ data })).to.equal(true);
    });
  }
});
