// 汇率转换表（人民币基准）
const EXCHANGE_RATES = {
  CNY: 1,
  USD: 7.30,
  EUR: 7.90,
  JPY: 0.05,
  HKD: 0.93
};

// 生成对比图事件
document.getElementById("generate").onclick = function() {
  const suppliersData = processSupplierData();
  if (!suppliersData.length) return alert("请先录入供应商数据！");
  
  renderComparisonChart(suppliersData);
};

// 数据处理逻辑
function processSupplierData() {
  return Array.from(document.querySelectorAll(".row-item")).map(row => {
    const price = parseFloat(row.children[2].value);
    const currency = row.children[3].value;
    const deliveryDays = parseInt(row.children[4].value);

    // 转换为人民币计价
    const normalizedPrice = price / EXCHANGE_RATES[currency];
    
    return {
      supplier: row.children[0].value,
      product: row.children[1].value,
      originalPrice: price,
      normalizedPrice: normalizedPrice,
      deliveryDays: deliveryDays,
      note: row.children[5].value
    };
  });
}

// 图表渲染逻辑
function renderComparisonChart(data) {
  const ctx = document.getElementById('price-chart');
  const weightPrice = parseFloat(document.getElementById('weight-price').value) || 60;
  const weightDelivery = parseFloat(document.getElementById('weight-delivery').value) || 40;
  
  // 计算价格得分
  const prices = data.map(d => d.normalizedPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  
  // 计算交期得分
  const deliveries = data.map(d => d.deliveryDays);
  const minDelivery = Math.min(...deliveries);
  const maxDelivery = Math.max(...deliveries);
  
  // 生成图表数据
  const chartData = {
    labels: data.map(d => d.supplier),
    datasets: [{
      label: '综合得分',
      data: data.map(d => {
        const priceScore = 100 - ((d.normalizedPrice - minPrice) / (maxPrice - minPrice)) * 100;
        const deliveryScore = 100 - ((d.deliveryDays - minDelivery) / (maxDelivery - minDelivery)) * 100;
        return (priceScore * weightPrice + deliveryScore * weightDelivery) / 100;
      }),
      backgroundColor: 'rgba(54, 162, 235, 0.5)',
      borderColor: 'rgb(54, 162, 235)',
      borderWidth: 1
    }]
  };

  // 销毁旧图表实例
  if (ctx.chart) ctx.chart.destroy();
  
  // 创建新图表
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: chartData,
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: '综合得分 (%)' }
        }
      }
    }
  });
}

// 导出图表图片
document.getElementById("export-chart").onclick = function() {
  const canvas = document.getElementById("price-chart");
  if (!canvas.chart) return alert("请先生成对比图！");
  
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.download = "价格对比图表.png";
  a.href = url;
  a.click();
};

// 导出Excel功能
document.getElementById("export-excel").onclick = function() {
  const data = processSupplierData();
  if (data.length === 0) return alert("没有可导出的数据！");
  
  // 计算得分数据
  const scores = calculateAllScores(data);
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data.map((d, i) => ({
    "供应商": d.supplier,
    "产品": d.product,
    "原始价格": d.originalPrice,
    "货币类型": d.currency,
    "标准化价格(CNY)": d.normalizedPrice.toFixed(2),
    "交期(天)": d.deliveryDays,
    "价格得分": scores[i].priceScore.toFixed(1),
    "交期得分": scores[i].deliveryScore.toFixed(1),
    "综合得分": scores[i].totalScore.toFixed(1),
    "备注": d.note
  })));
  
  XLSX.utils.book_append_sheet(wb, ws, "供应商报价");
  XLSX.writeFile(wb, "供应商报价对比.xlsx");
};

function calculateAllScores(data) {
  const weightPrice = parseFloat(document.getElementById('weight-price').value) || 60;
  const weightDelivery = parseFloat(document.getElementById('weight-delivery').value) || 40;

  const prices = data.map(d => d.normalizedPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const deliveries = data.map(d => d.deliveryDays);
  const minDelivery = Math.min(...deliveries);
  const maxDelivery = Math.max(...deliveries);

  return data.map(d => {
    const priceScore = 100 - ((d.normalizedPrice - minPrice) / (maxPrice - minPrice)) * 100;
    const deliveryScore = 100 - ((d.deliveryDays - minDelivery) / (maxDelivery - minDelivery)) * 100;
    const totalScore = (priceScore * weightPrice + deliveryScore * weightDelivery) / 100;
    return { priceScore, deliveryScore, totalScore };
  });
}