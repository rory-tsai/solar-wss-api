// sunlight-api-server/index.js
const express = require("express");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

let latestData = {}; // 快取日照資料 { "新北市": { irradiance, timestamp, ... } }
let rawData = {};     // 原始 WebSocket 資料
let receivedOnce = false;

// WebSocket 連接陽光資料來源
const ws = new WebSocket("wss://sunshine.ipvita.net/ws/realtime_sunshine");

ws.on("open", () => {
  console.log("WebSocket connected");
});

ws.on("message", (msg) => {
  if (receivedOnce) return;

  try {
    const parsed = JSON.parse(msg.toString());
    rawData = parsed;

    const timestamp = parsed.time || new Date().toISOString();
    const result = {};
    let count = 0;

    const data = parsed.data; // ✅ 正確來源
    for (const key in data) {
      const item = data[key];
      if (item && item.city_name && typeof item.sunshine === "number") {
        result[item.city_name] = {
          irradiance: item.sunshine,
          today_sunshine: item.today_sunshine,
          timestamp
        };
        count++;
      }
    }

    latestData = result;
    receivedOnce = true;
    console.log("✅ 成功儲存資料，城市數：", count);
    console.log("關閉 WebSocket 連接");
    ws.close();

  } catch (err) {
    console.error("Error parsing WebSocket message:", err);
    console.warn("原始資料：", msg.toString());
  }
});


ws.on("error", (err) => {
  console.error("WebSocket error:", err);
});

// GET /sunlight?city=新北市
app.get("/sunlight", (req, res) => {
  console.log("✅ /sunlight API 被呼叫");
  const query = req.query.city;

  if (!query) {
    return res.status(400).json({ error: "Missing 'city' query parameter" });
  }

  console.log("目前資料有哪些城市：", Object.keys(latestData));

  // 模糊匹配城市名稱
  const matched = Object.keys(latestData).find(name => name.includes(query));
  if (!matched) {
    return res.status(404).json({ error: "City not found or no data yet" });
  }

  const result = latestData[matched];
  res.json({ city: matched, ...result });
});

// GET /sunlight/all → 回傳原始資料
app.get("/sunlight/all", (req, res) => {
  res.json(rawData);
});

app.get("/health", (req, res) => res.send("OK"));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
