
const API_BASE_URL = "your render API URL"; // ← 換成您的 Render API URL

function doGet(e) {
  return ContentService
    .createTextOutput("Webhook is working")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const event = JSON.parse(e.postData.contents).events[0];
    const userMessage = event.message.text.trim();
    const replyToken = event.replyToken;

    let responseText = "";

    // ✅ 日照查詢（例：#新北市日照 或 #新北日照）
    const match = userMessage.match(/#?(台|臺)?([\u4e00-\u9fa5]{1,4})(市|縣)?日照/);
    if (match) {
      const city = (match[2] || "") + (match[3] || "");

      try {
        const res = UrlFetchApp.fetch(`${API_BASE_URL}/sunlight?city=${encodeURIComponent(city)}`);
        const data = JSON.parse(res.getContentText());
        // 格式化時間
        const time = data.timestamp.replace("T", " ").split(".")[0];
        responseText = `☀️ ${data.city}目前日照：${data.irradiance} W/m²\n今日累積：${data.today_sunshine} 小時\n更新：${time}`;
      } catch (err) {
        responseText = `無法取得 ${city} 日照資料，請稍後再試。`;
      }

      return sendReply(replyToken, responseText);
    }

    // ✅ 備品查詢：#備品查詢 / #查詢備品
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("工作表1");
    const data = sheet.getDataRange().getValues();

    if (userMessage === "#備品查詢" || userMessage === "#查詢備品") {
      for (let i = 1; i < data.length; i++) {
        const [item, model, quantity, serial, prodDate, warrantyEnd, note] = data[i];
        responseText +=
          `📦 項目：${item}\n` +
          `🔢 型號：${model}\n` +
          `📊 數量：${quantity}\n` +
          `🔖 序號：${serial}\n` +
          `🏭 出廠日期：${prodDate}\n` +
          `🛡️ 保固到期日：${warrantyEnd}\n` +
          `📝 備註：${note || "無"}\n` +
          `-----------------------\n`;
      }

    } else if (userMessage.startsWith("#查")) {
      const keyword = userMessage.replace("#查", "").trim();
      if (!keyword) {
        responseText = "請輸入查詢項目，例如：#查 筆電";
      } else {
        for (let i = 1; i < data.length; i++) {
          const [item, model, quantity, serial, prodDate, warrantyEnd, note] = data[i];
          if (item.includes(keyword)) {
            responseText +=
              `📦 項目：${item}\n` +
              `🔢 型號：${model}\n` +
              `📊 數量：${quantity}\n` +
              `🔖 序號：${serial}\n` +
              `🏭 出廠日期：${prodDate}\n` +
              `🛡️ 保固到期日：${warrantyEnd}\n` +
              `📝 備註：${note || "無"}\n` +
              `-----------------------\n`;
          }
        }
        if (responseText === "") {
          responseText = `查無項目：${keyword}`;
        }
      }
    } else {
      return ContentService.createTextOutput("No response").setMimeType(ContentService.MimeType.TEXT);
    }

    return sendReply(replyToken, responseText.trim());

  } catch (err) {
    return ContentService.createTextOutput("Error: " + err).setMimeType(ContentService.MimeType.TEXT);
  }
}

function sendReply(replyToken, msg) {
  const LINE_TOKEN = "your line token"; // ← 換成您的 LINE Token

  const payload = JSON.stringify({
    replyToken: replyToken,
    messages: [{ type: "text", text: msg.slice(0, 4999) }]
  });

  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + LINE_TOKEN
    },
    payload: payload
  };

  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", options);
  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}