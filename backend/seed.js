const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const Product = require("./models/Product");
const Category = require("./models/Category");

const products = [
  {
    name: "Casual White T-Shirt",
    brand: "Roadster",
    price: 499,
    discount: "60% OFF",
    description: "Classic white t-shirt made from premium cotton. Perfect for everyday wear with a comfortable regular fit.",
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=500&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=500&auto=format&fit=crop",
    ],
    category: "Men",
  },
  {
    name: "Denim Jacket",
    brand: "Levis",
    price: 2499,
    discount: "40% OFF",
    description: "Classic denim jacket with a modern twist. Features premium quality denim and comfortable fit.",
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://images.unsplash.com/photo-1523205771623-e0faa4d2813d?w=500&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=500&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1601933973783-43cf8a7d4c5f?w=500&auto=format&fit=crop",
    ],
    category: "Men",
  },
  {
    name: "Summer Dress",
    brand: "ONLY",
    price: 1299,
    discount: "50% OFF",
    description: "Flowy summer dress perfect for warm weather. Made from lightweight fabric with a flattering cut.",
    sizes: ["XS", "S", "M", "L"],
    images: [
      "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=500&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1623609163859-ca93c959b98a?w=500&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500&auto=format&fit=crop",
    ],
    category: "Women",
  },
  {
    name: "Classic Sneakers",
    brand: "Nike",
    price: 3499,
    discount: "30% OFF",
    description: "Versatile sneakers that combine style and comfort. Perfect for both casual wear and light exercise.",
    sizes: ["UK6", "UK7", "UK8", "UK9", "UK10"],
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=500&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500&auto=format&fit=crop",
    ],
    category: "Footwear",
  },
  {
    name: "Slim Fit Chinos",
    brand: "H&M",
    price: 1499,
    discount: "35% OFF",
    description: "Slim fit chinos in stretch cotton. Comfortable and stylish for everyday wear.",
    sizes: ["28", "30", "32", "34", "36"],
    images: [
      "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=500&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=500&auto=format&fit=crop",
    ],
    category: "Men",
  },
  {
    name: "Floral Kurti",
    brand: "W",
    price: 899,
    discount: "45% OFF",
    description: "Beautiful floral printed kurti made from soft cotton fabric. Perfect for casual and festive occasions.",
    sizes: ["S", "M", "L", "XL", "XXL"],
    images: [
      "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=500&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=500&auto=format&fit=crop",
    ],
    category: "Women",
  },
  {
    name: "Formal Navy Blazer",
    brand: "Van Heusen",
    price: 3999,
    discount: "20% OFF",
    description: "A structured slim-fit single-breasted blazer for formal corporate styling.",
    sizes: ["38", "40", "42", "44"],
    images: [
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format&fit=crop",
    ],
    category: "Men",
  },
  {
    name: "High-Waist Blue Jeans",
    brand: "Zara",
    price: 2299,
    discount: "30% OFF",
    description: "Classic high-waist straight fit blue denim jeans.",
    sizes: ["28", "30", "32"],
    images: [
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500&auto=format&fit=crop",
    ],
    category: "Women",
  },
  {
    name: "Casual Cotton Top",
    brand: "Mango",
    price: 999,
    discount: "15% OFF",
    description: "Comfortable breathable daily wear top for women.",
    sizes: ["XS", "S", "M", "L"],
    images: [
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=500&auto=format&fit=crop",
    ],
    category: "Women",
  },
  {
    name: "Formal Leather Oxford Shoes",
    brand: "Clarks",
    price: 4499,
    discount: "25% OFF",
    description: "Premium genuine leather oxford formal dress shoes.",
    sizes: ["UK7", "UK8", "UK9", "UK10"],
    images: [
      "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=500&auto=format&fit=crop",
    ],
    category: "Footwear",
  },
  {
    name: "Running Shoes Sport",
    brand: "Adidas",
    price: 5999,
    discount: "35% OFF",
    description: "High-performance running shoes with cloud foam comfort technology.",
    sizes: ["UK7", "UK8", "UK9", "UK10"],
    images: [
      "https://images.unsplash.com/photo-1587563876166-12f71130b5a3?w=500&auto=format&fit=crop",
    ],
    category: "Footwear",
  },
  {
    name: "Superheroes Print T-Shirt",
    brand: "USPA Kids",
    price: 599,
    discount: "50% OFF",
    description: "Fun character printed graphic t-shirt for kids.",
    sizes: ["5-6Y", "7-8Y", "9-10Y"],
    images: [
      "https://images.unsplash.com/photo-1519457431-44ccd64a579b?w=500&auto=format&fit=crop",
    ],
    category: "Kids",
  },
  {
    name: "Girls Cotton Frock",
    brand: "Mothercare",
    price: 1199,
    discount: "40% OFF",
    description: "Lightweight and adorable floral cotton frock for girls.",
    sizes: ["4-5Y", "5-6Y", "6-7Y"],
    images: [
      "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=500&auto=format&fit=crop",
    ],
    category: "Kids",
  },
  {
    name: "Men Slim Fit Checked Shirt",
    brand: "Roadster",
    price: 899,
    discount: "50% OFF",
    description: "Stylish red and black checked casual shirt for men. Regular fit, 100% cotton.",
    sizes: ["M", "L", "XL"],
    images: [
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&auto=format&fit=crop",
    ],
    category: "Men",
  },
  {
    name: "Women Oversized Hoodie",
    brand: "H&M",
    price: 1999,
    discount: "30% OFF",
    description: "Cozy oversized hoodie in soft sweatshirt fabric. Drop shoulders and kangaroo pocket.",
    sizes: ["XS", "S", "M", "L"],
    images: [
      "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=500&auto=format&fit=crop",
    ],
    category: "Women",
  },
  {
    name: "Classic White Sneakers",
    brand: "Puma",
    price: 2999,
    discount: "20% OFF",
    description: "Minimalist leather white sneakers with comfortable cushioning.",
    sizes: ["UK7", "UK8", "UK9", "UK10"],
    images: [
      "https://images.unsplash.com/photo-1597045566677-8cf032ed6634?w=500&auto=format&fit=crop",
    ],
    category: "Footwear",
  },
  {
    name: "Boys Denim Dungarees",
    brand: "USPA Kids",
    price: 1599,
    discount: "45% OFF",
    description: "Durable blue denim dungarees for active boys.",
    sizes: ["3-4Y", "5-6Y", "7-8Y"],
    images: [
      "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=500&auto=format&fit=crop",
    ],
    category: "Kids",
  },
  {
    name: "Women Printed A-Line Kurta",
    brand: "BIBA",
    price: 1799,
    discount: "40% OFF",
    description: "Elegant printed A-line kurta in comfortable cotton, perfect for ethnic wear.",
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://images.unsplash.com/photo-1610030469668-93535c17b6b3?w=500&auto=format&fit=crop",
    ],
    category: "Women",
  },
  {
    name: "Leather Chelsea Boots",
    brand: "Woodland",
    price: 4999,
    discount: "15% OFF",
    description: "Premium leather Chelsea boots with durable grip sole.",
    sizes: ["UK8", "UK9", "UK10"],
    images: [
      "https://images.unsplash.com/photo-1638247025967-b4e38f787b76?w=500&auto=format&fit=crop",
    ],
    category: "Footwear",
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing data
    await Product.deleteMany({});
    await Category.deleteMany({});
    console.log("Cleared existing data");

    // Insert products
    const insertedProducts = await Product.insertMany(products);
    console.log(`Inserted ${insertedProducts.length} products`);

    // Create categories with product references
    const categories = [
      {
        name: "Men",
        subcategory: ["T-Shirts", "Shirts", "Jeans", "Trousers", "Suits"],
        image: "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=500&auto=format&fit=crop",
        productId: [
          insertedProducts[0]._id, 
          insertedProducts[1]._id, 
          insertedProducts[4]._id,
          insertedProducts[6]._id
        ],
      },
      {
        name: "Women",
        subcategory: ["Dresses", "Tops", "Ethnic Wear", "Western Wear"],
        image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&auto=format&fit=crop",
        productId: [
          insertedProducts[2]._id, 
          insertedProducts[5]._id,
          insertedProducts[7]._id,
          insertedProducts[8]._id
        ],
      },
      {
        name: "Footwear",
        subcategory: ["Sneakers", "Formal Shoes", "Sports Shoes", "Sandals"],
        image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&auto=format&fit=crop",
        productId: [
          insertedProducts[3]._id,
          insertedProducts[9]._id,
          insertedProducts[10]._id
        ],
      },
      {
        name: "Kids",
        subcategory: ["Boys Clothing", "Girls Clothing", "Infants", "Toys"],
        image: "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=500&auto=format&fit=crop",
        productId: [
          insertedProducts[11]._id,
          insertedProducts[12]._id
        ],
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
