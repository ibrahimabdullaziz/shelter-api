import ApiError from "../../common/utils/ApiError";
import { BookingStatus, Prisma } from "@prisma/client";
import { bookingServiceDependencies } from "./dependencies/bookings.dependencies";
import type { BookingTransaction } from "./types/bookings.types";

export { bookingServiceDependencies } from "./dependencies/bookings.dependencies";

const prisma = bookingServiceDependencies.prisma;

function validateDates(checkIn: Date, checkOut: Date) {
  if (
    Number.isNaN(checkIn.getTime()) ||
    Number.isNaN(checkOut.getTime()) ||
    checkOut <= checkIn
  ) {
    throw new ApiError(400, "Invalid booking dates");
  }
}

async function isUnitAvailable(
  tx: BookingTransaction,
  unitId: string,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: string,
) {
  const bookedUnit = await tx.booking.findFirst({
    where: {
      ...(excludeBookingId && { id: { not: excludeBookingId } }),
      unitId: unitId,
      status: { in: ["PENDING", "CONFIRMED"] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
  });

  return !bookedUnit;
}

async function calculatePrice(unitId: string, checkIn: Date, checkOut: Date) {
  validateDates(checkIn, checkOut);
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });

  if (!unit) {
    throw new ApiError(404, "Unit is not found!");
  }

  if (unit.deletedAt || !unit.isActive) {
    throw new ApiError(404, "Unit is not available");
  }

  const numberOfNights: number =
    (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24);

  return numberOfNights * Number(unit.pricePerNight);
}

async function checkHost(
  bookingId: string,
  hostId: string,
  status: BookingStatus,
) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId },
    include: {
      unit: {
        select: {
          ownerId: true,
        },
      },
    },
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (booking.unit.ownerId !== hostId) {
    throw new ApiError(403, "You are not authorized to access this unit!");
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: status },
  });

  return updatedBooking;
}

export async function createBookingService(
  guestId: string,
  unitId: string,
  checkIn: Date,
  checkOut: Date,
) {
  validateDates(checkIn, checkOut);
  const totalPrice = await calculatePrice(unitId, checkIn, checkOut);
  if (isNaN(totalPrice) || totalPrice <= 0) {
    throw new ApiError(400, "Invalid pricing for the selected dates");
  }

  return await prisma.$transaction(async (tx) => {
    const units = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Unit" WHERE id = ${unitId} FOR UPDATE`;

    if (!units.length) {
      throw new ApiError(404, "Unit not found");
    }

    const isAvailable = await isUnitAvailable(tx, unitId, checkIn, checkOut);
    if (!isAvailable) {
      throw new ApiError(409, "Unit not available for these dates");
    }

    const booking = await tx.booking.create({
      data: {
        unitId,
        guestId,
        checkIn,
        checkOut,
        totalPrice,
        status: "PENDING",
      },
    });

    return booking;
  });
}

export async function updateBookingService(
  bookingId: string,
  guestId: string,
  newDates: Date[],
) {
  const checkIn = newDates[0];
  const checkOut = newDates[1];
  if (!checkIn || !checkOut) {
    throw new ApiError(400, "Invalid booking dates");
  }
  validateDates(checkIn, checkOut);
  const existingBooking = await prisma.booking.findFirst({
    where: { id: bookingId, guestId: guestId },
  });

  if (!existingBooking) {
    throw new ApiError(404, "Booking not found");
  }

  if (existingBooking.status !== "PENDING") {
    throw new ApiError(400, "sorry, your booking can`t be undo..");
  }

  const { unitId } = existingBooking;

  const totalPrice = await calculatePrice(unitId, checkIn, checkOut);
  if (isNaN(totalPrice) || totalPrice <= 0) {
    throw new ApiError(400, "Invalid pricing for the selected dates");
  }

  return await prisma.$transaction(async (tx) => {
    const units = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Unit" WHERE id = ${unitId} FOR UPDATE`;

    if (!units.length) {
      throw new ApiError(404, "Unit not found");
    }

    const isAvailable = await isUnitAvailable(
      tx,
      unitId,
      checkIn,
      checkOut,
      bookingId,
    );
    if (!isAvailable) {
      throw new ApiError(409, "Unit not available for these dates");
    }

    const updatedBooking = await tx.booking.update({
      where: { id: bookingId },
      data: { checkIn, checkOut },
    });

    return updatedBooking;
  });
}

export async function cancelBookingService(bookingId: string, guestId: string) {
  const booking = await prisma.booking.findFirst({ where: { id: bookingId } });

  if (!booking) {
    throw new ApiError(404, "Booking for this unit is not found!");
  }

  if (booking.guestId !== guestId) {
    throw new ApiError(
      403,
      "you are not authorized to access this unit bookings!",
    );
  }

  if (booking.status !== "PENDING") {
    throw new ApiError(400, "Only pending bookings can be canceled");
  }

  const canceledBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED" },
  });

  return canceledBooking;
}

export async function confirmBookingService(bookingId: string, hostId: string) {
  return checkHost(bookingId, hostId, "CONFIRMED");
}

export async function rejectBookingService(bookingId: string, hostId: string) {
  return checkHost(bookingId, hostId, "REJECTED");
}

export async function getGuestBookingsService(guestId: string) {
  return await prisma.booking.findMany({
    where: { guestId },
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
}

export async function getHostBookingsService(hostId: string) {
  return await prisma.booking.findMany({
    where: { unit: { ownerId: hostId } },
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
}

export const bookingServices = {
  createBookingService,
  updateBookingService,
  cancelBookingService,
  confirmBookingService,
  rejectBookingService,
  getGuestBookingsService,
  getHostBookingsService,
};
