// ======== 评分辅助函数 ========
function calculateScore(data, weights) {
  const prices = data.map(item => parseFloat(item.price));
  const deliveries = data.map(item => parseFloat(item.delivery));

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minDelivery = Math.min(...deliveries);
  const maxDelivery = Math.max(...deliveries);

  return data.map(item => {
    const priceScore = (maxPrice === minPrice)
      ? 100
      : 100 - ((item.price - minPrice) / (maxPrice - minPrice)) * 100;
    const deliveryScore = (maxDelivery === minDelivery)
      ? 100
      : 100 - ((item.delivery - minDelivery) / (maxDelivery - minDelivery)) * 100;
    const totalScore = priceScore * weights.price + deliveryScore * weights.delivery;

    return {
      ...item,
      priceScore: priceScore.toFixed(2),
      deliveryScore: deliveryScore.toFixed(2),
      totalScore: totalScore.toFixed(2)
    };
  });
}

// ======== 显示静态“参考汇率” ========
const exchangeRates = {
  CNY: 1.00,
  USD: 7.30,
  EUR: 7.90,
  JPY: 0.05,
  HKD: 0.93
};

document.getElementById("exchange-rate").innerText =
  `参考汇率：CNY = ${exchangeRates.CNY.toFixed(2)}, USD = ${exchangeRates.USD.toFixed(2)}, ` +
  `EUR = ${exchangeRates.EUR.toFixed(2)}, JPY = ${exchangeRates.JPY.toFixed(2)}, HKD = ${exchangeRates.HKD.toFixed(2)}`;

// ======== “添加供应商”按钮逻辑 ========
document.getElementById("add-row").addEventListener("click", () => {
  const rowsContainer = document.getElementById("rows-container");
  const templateRow = rowsContainer.querySelector(".row-item");
  const newRow = templateRow.cloneNode(true);
  // 清空所有 input、select 的值
  newRow.querySelectorAll("input").forEach(input => input.value = "");
  newRow.querySelector("select").value = "CNY";
  rowsContainer.appendChild(newRow);
});

// ======== 删除行逻辑 ========
document.getElementById("rows-container").addEventListener("click", (e) => {
  if (e.target.classList.contains("delete-row")) {
    const allRows = document.querySelectorAll("#rows-container .row-item");
    if (allRows.length > 1) {
      e.target.closest(".row-item").remove();
    }
  }
});

// ======== 生成对比图逻辑 ========
let priceChart = null;
document.getElementById("generate").addEventListener("click", () => {
  // 1. 读取所有行的数据
  const rows = Array.from(document.querySelectorAll("#rows-container .row-item"));
  const data = [];

  rows.forEach(row => {
    const inputs = row.querySelectorAll("input, select");
    const [supplier, product, priceStr, currency, deliveryStr, remark] =
      Array.from(inputs).map(el => el.value.trim());

    if (!supplier || !priceStr || !deliveryStr) return;
    const priceNum = parseFloat(priceStr);
    const deliveryNum = parseFloat(deliveryStr);
    const convertedPrice = priceNum * (exchangeRates[currency] || 1);

    data.push({
      supplier,
      product,
      price: convertedPrice,
      delivery: deliveryNum,
      remark
    });
  });

  if (!data.length) {
    alert("请填写至少一条完整的报价数据（供应商、单价、交期）");
    return;
  }

  // 2. 获取用户输入的权重（没有输入时默认 60/40）
  let weightPrice = parseFloat(document.getElementById("weight-price").value);
  let weightDelivery = parseFloat(document.getElementById("weight-delivery").value);
  if (isNaN(weightPrice) && isNaN(weightDelivery)) {
    weightPrice = 60;
    weightDelivery = 40;
  } else {
    if (isNaN(weightPrice)) weightPrice = 60;
    if (isNaN(weightDelivery)) weightDelivery = 40;
  }
  const totalWeight = weightPrice + weightDelivery;
  const weights = {
    price: weightPrice / totalWeight,
    delivery: weightDelivery / totalWeight
  };

  // 3. 计算评分
  const scoredData = calculateScore(data, weights);
  localStorage.setItem("last-quotes", JSON.stringify(scoredData));

  // 4. 渲染 Chart.js
  const ctx = document.getElementById("price-chart").getContext("2d");
  if (priceChart) priceChart.destroy();

  priceChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: scoredData.map((item, idx) => `${idx + 1}. ${item.supplier}`),
      datasets: [{
        label: "综合评分",
        data: scoredData.map(item => item.totalScore),
        backgroundColor: scoredData.map((_, idx) =>
          idx === 0 ? "rgba(74, 222, 128, 0.8)" : "rgba(96, 165, 250, 0.6)"
        )
      }]
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const item = scoredData[ctx.dataIndex];
              return [
                `✅ 综合评分：${item.totalScore}`,
                `💰 价格得分：${item.priceScore}`,
                `⏱️ 交期得分：${item.deliveryScore}`
              ];
            }
          }
        },
        legend: { display: false }
      },
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
});

// ======== 导出 Excel（仅数据） ========
document.getElementById("export-excel").addEventListener("click", () => {
  const data = JSON.parse(localStorage.getItem("last-quotes") || "[]");
  if (!data.length) {
    return alert("请先生成对比图，才能导出 Excel！");
  }

  const header = ["序号", "供应商", "产品", "价格(CNY)", "交期(天)", "备注", "综合评分"];
  const rows = data.map((item, idx) => [
    idx + 1,
    item.supplier,
    item.product,
    item.price.toFixed(2),
    item.delivery,
    item.remark || "",
    item.totalScore
  ]);
  const aoa = [header, ...rows];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, "报价比价");
  XLSX.writeFile(wb, "报价比价结果.xlsx");
});

// ======== 导出图表图片（PNG） ========
document.getElementById("export-chart").addEventListener("click", () => {
  if (!priceChart) {
    return alert("请先生成对比图，才能导出图表图片！");
  }
  document.getElementById("price-chart").toBlob(blob => {
    saveAs(blob, "报价对比图.png");
  });
});

// ======== 用户反馈 Modal 的逻辑 ========
const feedbackButton = document.getElementById("feedback-button");
const feedbackModal = document.getElementById("feedback-modal");
const feedbackCancel = document.getElementById("feedback-cancel");
const feedbackSubmit = document.getElementById("feedback-submit");
const feedbackText = document.getElementById("feedback-text");

// 打开反馈弹窗
feedbackButton.addEventListener("click", () => {
  feedbackModal.classList.remove("hidden");
  feedbackModal.classList.add("flex");
});

// 取消关闭
feedbackCancel.addEventListener("click", () => {
  feedbackModal.classList.add("hidden");
  feedbackModal.classList.remove("flex");
});

// 提交反馈
feedbackSubmit.addEventListener("click", () => {
  const text = feedbackText.value.trim();
  if (!text) {
    alert("请先填写反馈内容！");
    return;
  }
  // 使用 mailto 发送到预设邮箱（请将 youremail@example.com 替换成你的真实邮箱）
  const mailto = `mailto:youremail@example.com?subject=网站反馈&body=${encodeURIComponent(text)}`;
  window.location.href = mailto;

  // 同时将反馈保存到 localStorage（可选）
  let allFeedbacks = JSON.parse(localStorage.getItem("user-feedbacks") || "[]");
  allFeedbacks.push({
    content: text,
    time: new Date().toLocaleString()
  });
  localStorage.setItem("user-feedbacks", JSON.stringify(allFeedbacks));

  alert("感谢你的反馈！页面稍后将关闭反馈弹窗。");
  feedbackText.value = "";
  feedbackModal.classList.add("hidden");
  feedbackModal.classList.remove("flex");
});
