// 评分辅助函数
function calculateScore(data, weights) {
  const prices = data.map(item => parseFloat(item.price));
  const deliveries = data.map(item => parseFloat(item.delivery));

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minDelivery = Math.min(...deliveries);
  const maxDelivery = Math.max(...deliveries);

  return data.map(item => {
    const priceScore = (maxPrice === minPrice) ? 100 : 100 - ((item.price - minPrice) / (maxPrice - minPrice)) * 100;
    const deliveryScore = (maxDelivery === minDelivery) ? 100 : 100 - ((item.delivery - minDelivery) / (maxDelivery - minDelivery)) * 100;
    const totalScore = priceScore * weights.price + deliveryScore * weights.delivery;

    return {
      ...item,
      priceScore: priceScore.toFixed(2),
      deliveryScore: deliveryScore.toFixed(2),
      totalScore: totalScore.toFixed(2)
    };
  });
}

// 加载汇率（静态）
const exchangeRates = {
  CNY: 1,
  USD: 7.3,
  EUR: 7.9,
  JPY: 0.05,
  HKD: 0.93
};
document.getElementById("exchange-rate").innerText =
  "参考汇率：CNY = 1.00, USD = 7.30, EUR = 7.90, JPY = 0.05, HKD = 0.93";

// 添加供应商行
document.getElementById("add-row").addEventListener("click", () => {
  const row = document.querySelector("#quote-form .grid").cloneNode(true);
  row.querySelectorAll("input").forEach(input => input.value = "");
  document.getElementById("quote-form").appendChild(row);
});

// 删除行按钮
document.getElementById("quote-form").addEventListener("click", e => {
  if (e.target.innerText.includes("删除")) {
    const grids = document.querySelectorAll("#quote-form .grid");
    if (grids.length > 1) e.target.closest(".grid").remove();
  }
});

// 生成对比图
document.getElementById("generate").addEventListener("click", () => {
  const rows = [...document.querySelectorAll("#quote-form .grid")];
  const data = [];

  rows.forEach(row => {
    const inputs = row.querySelectorAll("input, select");
    const [supplier, product, price, currency, delivery, remark] = Array.from(inputs).map(el => el.value.trim());
    if (!supplier || !price || !delivery) return;
    const convertedPrice = parseFloat(price) * (exchangeRates[currency] || 1);
    data.push({ supplier, product, price: convertedPrice, delivery: parseFloat(delivery), remark });
  });

  if (!data.length) return alert("请填写至少一条完整的报价数据");

  const weightPrice = parseFloat(document.getElementById("weight-price").value) || 60;
  const weightDelivery = parseFloat(document.getElementById("weight-delivery").value) || 40;
  const total = weightPrice + weightDelivery;
  const weights = { price: weightPrice / total, delivery: weightDelivery / total };

  const scored = calculateScore(data, weights);
  localStorage.setItem("last-quotes", JSON.stringify(scored));

  const ctx = document.getElementById("price-chart").getContext("2d");
  if (window.priceChart) window.priceChart.destroy();

  window.priceChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: scored.map((item, i) => `${i + 1}. ${item.supplier}`),
      datasets: [{
        label: "综合评分",
        data: scored.map(item => item.totalScore),
        backgroundColor: scored.map((_, i) => i === 0 ? "#4ade80" : "#60a5fa")
      }]
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const item = scored[ctx.dataIndex];
              return [
                `✅ 综合评分：${item.totalScore}`,
                `💰 价格得分：${item.priceScore}`,
                `⏱️ 交期得分：${item.deliveryScore}`
              ];
            }
          }
        },
        legend: { display: false }
      }
    }
  });
});

// 导出 Excel
document.getElementById("export-excel").addEventListener("click", () => {
  const data = JSON.parse(localStorage.getItem("last-quotes") || "[]");
  const rows = [["供应商", "产品", "价格(RMB)", "交期(天)", "备注", "综合评分"]].concat(
    data.map(item => [item.supplier, item.product, item.price, item.delivery, item.remark, item.totalScore])
  );
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "报价比价");
  XLSX.writeFile(wb, "报价比价结果.xlsx");
});

// 导出 Word
document.getElementById("export-word").addEventListener("click", async () => {
  const { Document, Packer, Paragraph, TextRun } = window.docx;
  const data = JSON.parse(localStorage.getItem("last-quotes") || "[]");

  const paragraphs = data.map((item, i) =>
    new Paragraph({
      children: [
        new TextRun(`${i + 1}. ${item.supplier} | ${item.product} | 价格：${item.price} RMB | 交期：${item.delivery} 天 | 综合评分：${item.totalScore}`)
      ]
    })
  );

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, "报价比价结果.docx");
});
