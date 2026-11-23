const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { createApp } = require("./app");
const { createSupabaseClient } = require("./config/supabase");
const { configureCloudinary } = require("./config/cloudinary");

const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const supabase = createSupabaseClient();
configureCloudinary();
const app = createApp({ supabase });

app.listen(port, () => {
  console.log(`Shruthi's Couture API listening on port ${port}`);
});
