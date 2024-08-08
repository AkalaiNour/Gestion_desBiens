const mongoose = require('mongoose');
const Category = require('./categorySchema'); // Import the Category model

// Define the connection URI
const uri = "mongodb://localhost:27017/Gestion_desBien"; // Replace with your MongoDB URI if different

async function main() {
  // Connect to MongoDB
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  // Define the documents to insert
  const documents = [
    {
      category: "Ventes immobilières",
      offerings: [
        "Appartement à vendre",
        "Maisons à vendre",
        "Villas-Riad à vendre",
        "Bureaux à vendre",
        "Local à vendre",
        "Terrains et fermes à vendre"
      ]
    },
    {
      category: "Locations immobilières",
      offerings: [
        "Appartement à louer",
        "Maisons à louer",
        "Villas-Riad à louer",
        "Bureaux à louer",
        "Locaux commerciaux à louer",
        "Terrains et fermes à louer"
      ]
    },
    {
      category: "Colocations Immobilières",
      offerings: [
        "Appartement Colocation",
        "Maison Colocation",
        "Villa - Riad Colocation"
      ]
    },
    {
      category: "Location de Vacances",
      offerings: [
        "Appartement location de vacances",
        "Maison location de vacances",
        "Villa - Riad location de vacances"
      ]
    }
  ];

  try {
    // Insert the documents into the collection
    const result = await Category.insertMany(documents);
    console.log(`Documents inserted with _id: ${result.map(doc => doc._id)}`);
  } catch (error) {
    console.error('Error occurred while inserting documents:', error);
  } finally {
    // Close the connection
    await mongoose.disconnect();
  }
}

main().catch(console.error);
