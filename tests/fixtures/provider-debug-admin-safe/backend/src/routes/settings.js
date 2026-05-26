const express = require("express");
const { authMiddleware, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authMiddleware, requireAdmin);

router.get("/settings/paypal/token", async (req, res) => {
  const response = await fetch(`${process.env.PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    body: "grant_type=client_credentials"
  });

  res.json({
    configured: response.ok,
    mode: process.env.PAYPAL_MODE || "sandbox"
  });
});

module.exports = router;
