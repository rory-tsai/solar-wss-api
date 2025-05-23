// sunlight-api-server/index.js
const express = require("express");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

let latestData = {}; // 快取日照資料 { "新北市": { irradiance, timestamp, ... } }
let rawData = {};     // 原始 WebSocket 資料

// 每次抓取 WebSocket 資料
function fetchSunlightData() {
  const ws = new WebSocket("wss://sunshine.ipvita.net/ws/realtime_sunshine");
  let received = false;

  ws.on("open", () => {
    console.log("[WS] WebSocket connected");
  });

  ws.on("message", (msg) => {
    if (received) return;

    try {
      const parsed = JSON.parse(msg.toString());
      rawData = parsed;

      const timestamp = parsed.time || new Date().toISOString();
      const result = {};
      const data = parsed.data;
      let count = 0;

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
      console.log("✅ 成功更新資料，城市數：", count);
      ws.close();
      received = true;

    } catch (err) {
      console.error("Error parsing WebSocket message:", err);
      console.warn("原始資料：", msg.toString());
    }
    console.log("✅ 每 15 分鐘更新一次資料");
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
}

// 初次執行抓資料
fetchSunlightData();

// 每 15 分鐘執行一次抓取
setInterval(fetchSunlightData, 15 * 60 * 1000 );


// GET /sunlight?city=新北市
app.get("/sunlight", (req, res) => {
  console.log("✅ /sunlight API 被呼叫");
  const query = req.query.city;

  if (!query) {
    return res.status(400).json({ error: "Missing 'city' query parameter" });
  }

  console.log("目前資料有哪些城市：", Object.keys(latestData));

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
