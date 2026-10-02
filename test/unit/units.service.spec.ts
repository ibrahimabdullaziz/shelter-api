import { expect } from "chai";
import { afterEach, describe, it } from "mocha";
import sinon from "sinon";
import { unitServiceDependencies } from "../../src/modules/units/units.service";
import {
  activateUnitService,
  createUnitService,
  deactivateUnitService,
  listUnitsService,
  softDeleteUnitService,
  updateUnitService,
} from "../../src/modules/units/units.service";

const unit = {
  id: "unit-1",
  ownerId: "host-1",
  isActive: true,
  deletedAt: null,
};

function prismaUnit() {
  return unitServiceDependencies.prisma.unit;
}

describe("units service", () => {
  afterEach(() => sinon.restore());

  it("creates a unit with the authenticated owner", async () => {
    const create = sinon.stub(prismaUnit(), "create").resolves(unit as never);
    const data = { title: "A home", pricePerNight: 100 };

    const result = await createUnitService("host-1", data as never);

    expect(
      create.calledWith({ data: { ...data, ownerId: "host-1" } }),
    ).to.equal(true);
    expect(result).to.equal(unit);
  });

  it("updates a unit owned by the authenticated owner", async () => {
    const findUnique = sinon
      .stub(prismaUnit(), "findUnique")
      .resolves(unit as never);
    const update = sinon
      .stub(prismaUnit(), "update")
      .resolves({ ...unit, title: "Updated" } as never);

    await updateUnitService("unit-1", "host-1", { title: "Updated" });

    expect(findUnique.calledWith({ where: { id: "unit-1" } })).to.equal(true);
    expect(
      update.calledWith({
        where: { id: "unit-1" },
        data: { title: "Updated" },
      }),
    ).to.equal(true);
  });

  it("rejects updates from a different owner", async () => {
    sinon.stub(prismaUnit(), "findUnique").resolves(unit as never);
    const update = sinon.stub(prismaUnit(), "update");

    try {
      await updateUnitService("unit-1", "other-host", { title: "Not allowed" });
      expect.fail("updateUnitService should reject");
    } catch (error) {
      expect(error).to.have.property("statusCode", 403);
      expect(error).to.have.property("message", "Not your unit");
      expect(update.called).to.equal(false);
    }
  });

  it("rejects updates to deleted units", async () => {
    sinon.stub(prismaUnit(), "findUnique").resolves({
      ...unit,
      deletedAt: new Date(),
    } as never);
    const update = sinon.stub(prismaUnit(), "update");

    try {
      await updateUnitService("unit-1", "host-1", { title: "Not allowed" });
      expect.fail("updateUnitService should reject");
    } catch (error) {
      expect(error).to.have.property("statusCode", 404);
      expect(update.called).to.equal(false);
    }
  });

  it("lists only active and non-deleted units", async () => {
    const findMany = sinon
      .stub(prismaUnit(), "findMany")
      .resolves([unit] as never);

    await listUnitsService({ page: 1, limit: 20 });

    expect(
      findMany.calledWith({
        where: { isActive: true, deletedAt: null },
        skip: 0,
        take: 20,
        include: { photos: true },
      }),
    ).to.equal(true);
  });

  it("applies city, category, price, and pagination filters", async () => {
    const findMany = sinon.stub(prismaUnit(), "findMany").resolves([] as never);

    await listUnitsService({
      cityId: "city-1",
      categoryId: "category-1",
      minPrice: 50,
      maxPrice: 200,
      page: 3,
      limit: 10,
    });

    expect(
      findMany.calledWith({
        where: {
          isActive: true,
          deletedAt: null,
          cityId: "city-1",
          categoryId: "category-1",
          pricePerNight: { gte: 50, lte: 200 },
        },
        skip: 20,
        take: 10,
        include: { photos: true },
      }),
    ).to.equal(true);
  });

  for (const [name, service] of [
    ["activates", activateUnitService],
    ["deactivates", deactivateUnitService],
    ["soft deletes", softDeleteUnitService],
  ] as const) {
    it(`rejects ${name} when the caller is not the owner`, async () => {
      sinon.stub(prismaUnit(), "findUnique").resolves(unit as never);
      const update = sinon.stub(prismaUnit(), "update");

      try {
        await service("unit-1", "other-host");
        expect.fail(`${name} should reject`);
      } catch (error) {
        expect(error).to.have.property("statusCode", 403);
        expect(error).to.have.property("message", "Not your unit");
        expect(update.called).to.equal(false);
      }
    });
  }

  it("activates and deactivates an owned unit", async () => {
    sinon.stub(prismaUnit(), "findUnique").resolves(unit as never);
    const update = sinon.stub(prismaUnit(), "update").resolves(unit as never);

    await activateUnitService("unit-1", "host-1");
    await deactivateUnitService("unit-1", "host-1");

    expect(
      update.firstCall.calledWith({
        where: { id: "unit-1" },
        data: { isActive: true },
      }),
    ).to.equal(true);
    expect(
      update.secondCall.calledWith({
        where: { id: "unit-1" },
        data: { isActive: false },
      }),
    ).to.equal(true);
  });

  it("soft deletes an owned unit", async () => {
    sinon.stub(prismaUnit(), "findUnique").resolves(unit as never);
    const update = sinon.stub(prismaUnit(), "update").resolves(unit as never);

    await softDeleteUnitService("unit-1", "host-1");

    expect(update.calledOnce).to.equal(true);
    expect(update.firstCall.args[0])
      .to.have.property("where")
      .that.deep.equals({ id: "unit-1" });
    expect(update.firstCall.args[0].data.deletedAt).to.be.instanceOf(Date);
  });
});
