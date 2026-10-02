import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { BookingStatus, Prisma } from "@prisma/client";
import prisma from "../src/db/prisma";

const seedPassword = "SeedPassword123!";
const unitPhotoUrls = [
  "https://images.unsplash.com/photo-1544070515-dada2bc86650?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1779642089774-b3bf433438f4?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1564260597137-9670bbba6912?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1734201862414-99c1ab56dd9e?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1748635954738-34c20f7e9733?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1719008681360-ea26073c966e?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
];

async function createCountries() {
  const countries = [
    { name: "Egypt", code: "EG" },
    { name: "France", code: "FR" },
    { name: "Italy", code: "IT" },
    { name: "Japan", code: "JP" },
    { name: "Canada", code: "CA" },
    { name: "Spain", code: "ES" },
    { name: "Greece", code: "GR" },
    { name: "Portugal", code: "PT" },
  ];

  return Promise.all(
    countries.map(({ name, code }) =>
      prisma.country.create({ data: { name, code } }),
    ),
  );
}

async function createCities(
  countries: Awaited<ReturnType<typeof createCountries>>,
) {
  const cities = [
    { name: "Cairo", countryCode: "EG" },
    { name: "Alexandria", countryCode: "EG" },
    { name: "Giza", countryCode: "EG" },
    { name: "Paris", countryCode: "FR" },
    { name: "Nice", countryCode: "FR" },
    { name: "Rome", countryCode: "IT" },
    { name: "Milan", countryCode: "IT" },
    { name: "Tokyo", countryCode: "JP" },
    { name: "Osaka", countryCode: "JP" },
    { name: "Toronto", countryCode: "CA" },
    { name: "Vancouver", countryCode: "CA" },
    { name: "Barcelona", countryCode: "ES" },
    { name: "Madrid", countryCode: "ES" },
    { name: "Athens", countryCode: "GR" },
    { name: "Santorini", countryCode: "GR" },
    { name: "Lisbon", countryCode: "PT" },
  ];

  return Promise.all(
    cities.map(({ name, countryCode }) => {
      const country = countries.find(({ code }) => code === countryCode);
      if (!country)
        throw new Error(`Missing seeded country with code ${countryCode}`);
      return prisma.city.create({ data: { name, countryId: country.id } });
    }),
  );
}

async function createCurrencies() {
  const currencies = [
    ["EGP", "E\u00A3"],
    ["USD", "$"],
    ["EUR", "\u20AC"],
    ["JPY", "\u00A5"],
    ["CAD", "C$"],
  ] as const;

  return Promise.all(
    currencies.map(([code, symbol]) =>
      prisma.currency.create({ data: { code, symbol } }),
    ),
  );
}

async function createCategories() {
  const names = [
    "Apartment",
    "Villa",
    "Studio",
    "Chalet",
    "Cabin",
    "House",
    "Townhouse",
  ];

  return Promise.all(
    names.map((name) => prisma.unitCategory.create({ data: { name } })),
  );
}

async function createUsers() {
  const password = await bcrypt.hash(seedPassword, 10);
  const usedEmails = new Set<string>();
  const seedEmail = async (role: "host" | "guest") => {
    let email: string;
    do {
      email = faker.internet
        .email({ provider: `seed-${role}.shelter.local` })
        .toLowerCase();
    } while (
      usedEmails.has(email) ||
      (await prisma.user.findUnique({ where: { email } }))
    );
    usedEmails.add(email);
    return email;
  };
  const hosts = await Promise.all(
    Array.from({ length: 5 }, async () =>
      prisma.user.create({
        data: {
          email: await seedEmail("host"),
          password,
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          role: "HOST",
          isVerified: true,
        },
      }),
    ),
  );
  const guests = await Promise.all(
    Array.from({ length: 15 }, async () =>
      prisma.user.create({
        data: {
          email: await seedEmail("guest"),
          password,
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          role: "GUEST",
          isVerified: true,
        },
      }),
    ),
  );
  return { hosts, guests };
}

async function createUnits(
  hosts: Awaited<ReturnType<typeof createUsers>>["hosts"],
  cities: Awaited<ReturnType<typeof createCities>>,
  currencies: Awaited<ReturnType<typeof createCurrencies>>,
  categories: Awaited<ReturnType<typeof createCategories>>,
) {
  return Promise.all(
    Array.from({ length: 50 }, (_, index) =>
      prisma.unit.create({
        data: {
          title: `${faker.commerce.productAdjective()} ${faker.commerce.productName()}`,
          description: faker.commerce.productDescription(),
          pricePerNight: faker.number.int({ min: 50, max: 500 }),
          maxGuests: faker.number.int({ min: 1, max: 8 }),
          isActive: true,
          ownerId: hosts[index % hosts.length].id,
          cityId: cities[index % cities.length].id,
          currencyId: currencies[index % currencies.length].id,
          categoryId: categories[index % categories.length].id,
        },
      }),
    ),
  );
}

async function createPhotos(units: Awaited<ReturnType<typeof createUnits>>) {
  const photos = [];

  for (const [unitIndex, unit] of units.entries()) {
    const count = faker.number.int({ min: 2, max: 4 });
    for (let index = 0; index < count; index += 1) {
      photos.push(
        await prisma.unitPhoto.create({
          data: {
            unitId: unit.id,
            url: unitPhotoUrls[(unitIndex + index) % unitPhotoUrls.length],
            publicId: `seed-photo-${unit.id}-${index + 1}`,
          },
        }),
      );
    }
  }

  return photos;
}

async function updateSeedPhotos() {
  const photos = await prisma.unitPhoto.findMany({
    where: { publicId: { startsWith: "seed-photo-" } },
    select: { id: true },
    orderBy: [{ unitId: "asc" }, { publicId: "asc" }],
  });

  if (photos.length === 0) {
    console.log("No seeded unit photos found.");
    return;
  }

  await prisma.$transaction(
    photos.map(({ id }, index) =>
      prisma.unitPhoto.update({
        where: { id },
        data: { url: unitPhotoUrls[index % unitPhotoUrls.length] },
      }),
    ),
    { timeout: 60_000 },
  );

  console.log(`Updated ${photos.length} seeded unit photos.`);
}

function bookingDates(status: BookingStatus, slot: number) {
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() + (status === "COMPLETED" ? -180 : 30));
  const checkIn = new Date(base);
  checkIn.setUTCDate(checkIn.getUTCDate() + slot * 10);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + 4);
  return { checkIn, checkOut };
}

async function createBookings(
  units: Awaited<ReturnType<typeof createUnits>>,
  guests: Awaited<ReturnType<typeof createUsers>>["guests"],
) {
  const statuses: BookingStatus[] = [
    ...Array<BookingStatus>(10).fill("COMPLETED"),
    ...Array<BookingStatus>(10).fill("PENDING"),
    ...Array<BookingStatus>(10).fill("CONFIRMED"),
  ];
  const slotsByUnit = new Map<string, number>();
  const bookings = [];

  for (const [index, status] of statuses.entries()) {
    const unit = units[index % units.length];
    const slot = slotsByUnit.get(unit.id) ?? 0;
    slotsByUnit.set(unit.id, slot + 1);
    const { checkIn, checkOut } = bookingDates(status, slot);
    const nights = (checkOut.getTime() - checkIn.getTime()) / 86_400_000;

    bookings.push(
      await prisma.booking.create({
        data: {
          unitId: unit.id,
          guestId: guests[index % guests.length].id,
          checkIn,
          checkOut,
          totalPrice: new Prisma.Decimal(nights * unit.pricePerNight),
          status,
        },
      }),
    );
  }

  return bookings;
}

async function createReviews(
  bookings: Awaited<ReturnType<typeof createBookings>>,
) {
  const reviewedPairs = new Set<string>();
  const reviews = [];

  for (const booking of bookings.filter(
    ({ status }) => status === "COMPLETED",
  )) {
    const pair = `${booking.unitId}:${booking.guestId}`;
    if (reviewedPairs.has(pair)) continue;
    reviewedPairs.add(pair);

    reviews.push(
      await prisma.unitReview.create({
        data: {
          unitId: booking.unitId,
          guestId: booking.guestId,
          rating: faker.number.int({ min: 3, max: 5 }),
          comment: faker.lorem.sentence(),
        },
      }),
    );
  }

  return reviews;
}

async function createFavorites(
  units: Awaited<ReturnType<typeof createUnits>>,
  guests: Awaited<ReturnType<typeof createUsers>>["guests"],
) {
  const favorites = [];
  const pairs = new Set<string>();
  const target = 40;
  let offset = 0;

  while (favorites.length < target) {
    const user = guests[offset % guests.length];
    const unit = units[(offset * 7) % units.length];
    const pair = `${user.id}:${unit.id}`;
    offset += 1;
    if (pairs.has(pair)) continue;
    pairs.add(pair);

    favorites.push(
      await prisma.unitFavorite.create({
        data: { userId: user.id, unitId: unit.id },
      }),
    );
  }

  return favorites;
}

async function ensureAdmin() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (admin) return { admin, created: false };
  return {
    admin: await prisma.user.create({
      data: {
        email: "seed-admin@shelter.local",
        password: await bcrypt.hash(seedPassword, 10),
        firstName: "Seed",
        lastName: "Admin",
        role: "ADMIN",
        isVerified: true,
      },
    }),
    created: true,
  };
}

export async function main() {
  console.log("Seeding database...");
  const { admin, created: adminCreated } = await ensureAdmin();
  const countries = await createCountries();
  const cities = await createCities(countries);
  const currencies = await createCurrencies();
  const categories = await createCategories();
  const { hosts, guests } = await createUsers();
  const units = await createUnits(hosts, cities, currencies, categories);
  const photos = await createPhotos(units);
  const bookings = await createBookings(units, guests);
  const reviews = await createReviews(bookings);
  const favorites = await createFavorites(units, guests);

  console.log(
    adminCreated
      ? `Admin created: ${admin.email}`
      : `Admin preserved: ${admin.email}`,
  );
  console.log(`Countries created: ${countries.length}`);
  console.log(`Cities created: ${cities.length}`);
  console.log(`Currencies created: ${currencies.length}`);
  console.log(`Categories created: ${categories.length}`);
  console.log(`Hosts created: ${hosts.length}`);
  console.log(`Guests created: ${guests.length}`);
  console.log(`Units created: ${units.length}`);
  console.log(`Photos created: ${photos.length}`);
  console.log(`Bookings created: ${bookings.length}`);
  console.log(`Reviews created: ${reviews.length}`);
  console.log(`Favorites created: ${favorites.length}`);
  console.log("Seed completed successfully.");
}

const task = process.argv[2] === "photos" ? updateSeedPhotos() : main();

task
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
