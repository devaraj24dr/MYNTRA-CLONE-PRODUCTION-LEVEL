const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const Product = require("./models/Product");
const Category = require("./models/Category");

const brands = {
  Men: ["Roadster", "Levis", "H&M", "Van Heusen", "Jack & Jones", "Zara", "USPA", "Wrogn", "Allen Solly"],
  Women: ["ONLY", "W", "Zara", "Mango", "BIBA", "H&M", "Aurelia", "Forever 21", "Vero Moda"],
  Footwear: ["Nike", "Adidas", "Puma", "Woodland", "Clarks", "Red Tape", "Bata", "Sparx", "Crocs"],
  Kids: ["USPA Kids", "Mothercare", "Gini & Jony", "Lilliput", "Chicco", "H&M Kids", "Marks & Spencer"],
};

const subcategories = {
  Men: ["T-Shirts", "Shirts", "Jeans", "Trousers", "Suits"],
  Women: ["Dresses", "Tops", "Ethnic Wear", "Western Wear"],
  Footwear: ["Sneakers", "Formal Shoes", "Sports Shoes", "Sandals"],
  Kids: ["Boys Clothing", "Girls Clothing", "Infants", "Toys"],
};

const images = {
  Men: [
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1618886614638-80e3c103d31a?w=500&auto=format&fit=crop",
  ],
  Women: [
    "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1623609163859-ca93c959b98a?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1610030469668-93535c17b6b3?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1618244972963-dbad0c4abf18?w=500&auto=format&fit=crop",
  ],
  Footwear: [
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1587563876166-12f71130b5a3?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1597045566677-8cf032ed6634?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1638247025967-b4e38f787b76?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1539185441755-769473a23570?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=500&auto=format&fit=crop",
  ],
  Kids: [
    "https://images.unsplash.com/photo-1519457431-44ccd64a579b?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1471286174243-e8a4d700f7e9?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1513907707964-b9d9c58b8a97?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1527082395-e939b847da0d?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1514090458221-65bb69cf63e6?w=500&auto=format&fit=crop",
  ]
};

const adjectives = ["Premium", "Classic", "Stylish", "Comfortable", "Modern", "Designer", "Casual", "Vintage", "Regular Fit", "Slim Fit", "Luxury", "Smart", "Elegant"];

const generatedProducts = [];

for (const cat of ["Men", "Women", "Footwear", "Kids"]) {
  const catBrands = brands[cat];
  const catSub = subcategories[cat];
  const catImages = images[cat];
  
  for (let i = 0; i < 25; i++) {
    const brand = catBrands[i % catBrands.length];
    const sub = catSub[i % catSub.length];
    const adj = adjectives[i % adjectives.length];
    
    const name = `${adj} ${sub.replace(" Clothing", "").replace(" Shoes", "")} ${i + 1}`;
    const price = 399 + (i * 150) % 3000;
    const discountPercent = 15 + (i * 7) % 55;
    const discount = `${discountPercent}% OFF`;
    const description = `This is a high quality ${name.toLowerCase()} designed by ${brand} for supreme comfort and elite style. Perfect for all seasons.`;
    
    const sizes = cat === "Footwear" 
      ? ["UK6", "UK7", "UK8", "UK9", "UK10"] 
      : cat === "Kids" 
        ? ["3-4Y", "5-6Y", "7-8Y", "9-10Y"]
        : ["S", "M", "L", "XL", "XXL"];
        
    const productImages = [
      catImages[i % catImages.length],
      catImages[(i + 1) % catImages.length]
    ];
    
    generatedProducts.push({
      name,
      brand,
      price,
      discount,
      description,
      sizes,
      images: productImages,
      category: cat,
      stock: 50 + (i * 12) % 200,
      isActive: true
    });
  }
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing data
    await Product.deleteMany({});
    await Category.deleteMany({});
    console.log("Cleared existing data");

    // Insert products
    const insertedProducts = await Product.insertMany(generatedProducts);
    console.log(`Inserted ${insertedProducts.length} products`);

    // Create categories with product references
    const categories = [
      {
        name: "Men",
        subcategory: subcategories.Men,
        image: "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=500&auto=format&fit=crop",
        productId: insertedProducts.filter(p => p.category === "Men").map(p => p._id),
      },
      {
        name: "Women",
        subcategory: subcategories.Women,
        image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&auto=format&fit=crop",
        productId: insertedProducts.filter(p => p.category === "Women").map(p => p._id),
      },
      {
        name: "Footwear",
        subcategory: subcategories.Footwear,
        image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&auto=format&fit=crop",
        productId: insertedProducts.filter(p => p.category === "Footwear").map(p => p._id),
      },
      {
        name: "Kids",
        subcategory: subcategories.Kids,
        image: "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=500&auto=format&fit=crop",
        productId: insertedProducts.filter(p => p.category === "Kids").map(p => p._id),
      },
    ];

    const insertedCategories = await Category.insertMany(categories);
    console.log(`Inserted ${insertedCategories.length} categories`);

    console.log("\n✅ Database seeded successfully!");
    mongoose.disconnect();
  } catch (error) {
    console.error("Seed error:", error);
    mongoose.disconnect();
    process.exit(1);
  }
}

seed();
