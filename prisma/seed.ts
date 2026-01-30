import bcrypt from "bcryptjs";
import {readFileSync} from "fs";
import {join} from "path";
import {prisma} from "../src/database";
import {CardModel} from "../src/generated/prisma/models/Card";
import {PokemonType} from "../src/generated/prisma/enums";

async function main() {
    console.log("🌱 Starting database seed...");

    await prisma.card.deleteMany();
    await prisma.user.deleteMany();

    const hashedPassword = await bcrypt.hash("password123", 10);

    await prisma.user.createMany({
        data: [
            {
                username: "red",
                email: "red@example.com",
                password: hashedPassword,
            },
            {
                username: "blue",
                email: "blue@example.com",
                password: hashedPassword,
            },
        ],
    });

    const redUser = await prisma.user.findUnique({where: {email: "red@example.com"}});
    const blueUser = await prisma.user.findUnique({where: {email: "blue@example.com"}});

    if (!redUser || !blueUser) {
        throw new Error("Failed to create users");
    }

    console.log("✅ Created users:", redUser.username, blueUser.username);

    const pokemonDataPath = join(__dirname, "data", "pokemon.json");
    const pokemonJson = readFileSync(pokemonDataPath, "utf-8");
    const pokemonData: CardModel[] = JSON.parse(pokemonJson);

    await Promise.all(
        pokemonData.map((pokemon) =>
            prisma.card.create({
                data: {
                    name: pokemon.name,
                    hp: pokemon.hp,
                    attack: pokemon.attack,
                    type: PokemonType[pokemon.type as keyof typeof PokemonType],
                    pokedexNumber: pokemon.pokedexNumber,
                    imgUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.pokedexNumber}.png`,
                },
            })
        )
    );

    console.log(`✅ Created ${pokemonData.length} Pokemon cards`);

    const allCards = await prisma.card.findMany();

    function getRandomCards<T>(cards: T[], count: number): T[] {
        const shuffled = [...cards].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    const redDeck = await prisma.deck.create({
        data: {
            name: "Starter Deck",
            userId: redUser.id,
        },
    });

    const redCards = getRandomCards(allCards, 10);
    for (const card of redCards) {
        await prisma.deckCard.create({
            data: {
                deckId: redDeck.id,
                cardId: card.id,
            },
        });
    }

    const blueDeck = await prisma.deck.create({
        data: {
            name: "Starter Deck",
            userId: blueUser.id,
        },
    });

    const blueCards = getRandomCards(allCards, 10);
    for (const card of blueCards) {
        await prisma.deckCard.create({
            data: {
                deckId: blueDeck.id,
                cardId: card.id,
            },
        });
    }

    console.log("✅ Created starter decks for red and blue");

    console.log("\n🎉 Database seeding completed!");
}

main()
    .catch((e) => {
        console.error("❌ Error seeding database:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });