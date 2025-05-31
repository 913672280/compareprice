const exchangeRates = {
  CNY: 1.0,
  USD: 7.3,
  EUR: 7.9,
  JPY: 0.046,
  HKD: 0.93
};

let currentChart = null;

function loadSavedData() {
  const saved = localStorage.getItem('quote-data');
  if (saved) {
    const rows = JSON.parse(saved);
    const form = document.getElementById('quote-form');
    rows.forEach((row, index) => {
      if (index > 0) document.getElementById('add-row').click();
      const rowEl = form.querySelectorAll('.grid')[index];
      const inputs = rowEl.querySelectorAll('input, select');
      inputs[0].value = row.supplier;
      inputs[1].value = row.product;
      inputs[2].value = row.price;
      inputs[3].value = row.currency;
      inputs[4].value = row.delivery;
      inputs[5].value = row.note;
    });
  }
}

function saveData() {
  const rows = document.querySelectorAll('.grid');
  const data = Array.from(rows).map(row => {
    const inputs = row.querySelectorAll('input, select');
    return {
      supplier: inputs[0].value,
      product: inputs[1].value,
      price: inputs[2].value,
      currency: inputs[3].value,
      delivery: inputs[4].value,
      note: inputs[5].value
    };
  });
  localStorage.setItem('quote-data', JSON.stringify(data));
}

function showExchangeRates() {
  let msg = '参考汇率：';
  for (const [key, val] of Object.entries(exchangeRates)) {
    msg += `${key} = ${val.toFixed(2)}, `;
  }
  document.getElementById('exchange-rate').innerText = msg.replace(/, $/, '');
}

document.getElementById('add-row').addEventListener('click', () => {
  const form = document.getElementById('quote-form');
  const clone = form.querySelector('.grid').cloneNode(true);
  clone.querySelectorAll('input').forEach(i => i.value = '');
  form.insertBefore(clone, document.getElementById('add-row'));
  saveData();
});

document.getElementById('quote-form').addEventListener('click', (e) => {
  if (e.target.innerText.includes('删除')) {
    const row = e.target.closest('.grid');
    if (document.querySelectorAll('.grid').length > 1) row.remove();
    saveData();
  }
});

document.getElementById('generate').addEventListener('click', () => {
  const rows = document.querySelectorAll('.grid');
  const entries = [];
  rows.forEach(row => {
    const [supplier, product, price, currency, delivery] = row.querySelectorAll('input, select');
    const val = {
      supplier: supplier.value,
      product: product.value,
      price: parseFloat(price.value),
      currency: currency.value,
      delivery: parseFloat(delivery.value)
    };
    if (val.supplier && !isNaN(val.price) && !isNaN(val.delivery) && exchangeRates[val.currency]) {
      val.priceCNY = val.price / exchangeRates[val.currency];
      entries.push(val);
    }
  });

  if (!entries.length) return alert('请填写完整报价信息');

  const pw = parseFloat(document.getElementById('weight-price').value) || 60;
  const dw = parseFloat(document.getElementById('weight-delivery').value) || 40;

  const minPrice = Math.min(...entries.map(e => e.priceCNY));
  const maxPrice = Math.max(...entries.map(e => e.priceCNY));
  const minDelivery = Math.min(...entries.map(e => e.delivery));
  const maxDelivery = Math.max(...entries.map(e => e.delivery));

  entries.forEach(e => {
    e.priceScore = 100 - ((e.priceCNY - minPrice) / (maxPrice - minPrice || 1)) * 100;
    e.deliveryScore = 100 - ((e.delivery - minDelivery) / (maxDelivery - minDelivery || 1)) * 100;
    e.score = ((e.priceScore * pw + e.deliveryScore * dw) / (pw + dw)).toFixed(2);
  });

  entries.sort((a, b) => b.score - a.score);
  const labels = entries.map(e => `${e.supplier}${e === entries[0] ? ' ✅推荐' : ''}`);
  const data = entries.map(e => parseFloat(e.score));
  const colors = entries.map((e, i) => i === 0 ? 'rgba(16,185,129,0.8)' : 'rgba(59,130,246,0.6)');

  if (currentChart) currentChart.destroy();
  const ctx = document.getElementById('price-chart').getContext('2d');
  currentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '综合评分（越高越优）',
        data,
        backgroundColor: colors
      }]
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => {
              const e = entries[context.dataIndex];
              return [`综合评分：${e.score}`, `价格得分：${e.priceScore.toFixed(2)}`, `交期得分：${e.deliveryScore.toFixed(2)}`];
            }
          }
        }
      },
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });

  saveData();
});

document.getElementById('export-excel').addEventListener('click', () => {
  const rows = document.querySelectorAll('.grid');
  const data = [['供应商', '产品', '单价', '货币', '交期', '备注', '综合评分']];
  rows.forEach((row, i) => {
    const [s, p, pr, c, d, n] = row.querySelectorAll('input, select');
    const score = currentChart ? currentChart.data.datasets[0].data[i] : '';
    data.push([s.value, p.value, pr.value, c.value, d.value, n.value, score]);
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '报价数据');
  XLSX.writeFile(wb, '报价数据.xlsx');
});

document.getElementById('export-word').addEventListener('click', async () => {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun } = window.docx;
  const rows = document.querySelectorAll('.grid');
  const tableRows = [
    new TableRow({
      children: ['供应商', '产品', '单价', '货币', '交期', '备注', '综合评分'].map(
        text => new TableCell({ children: [new Paragraph(text)] })
      )
    })
  ];
  rows.forEach((row, i) => {
    const [s, p, pr, c, d, n] = row.querySelectorAll('input, select');
    const score = currentChart ? currentChart.data.datasets[0].data[i] : '';
    tableRows.push(
      new TableRow({
        children: [s.value, p.value, pr.value, c.value, d.value, n.value, score].map(
          text => new TableCell({ children: [new Paragraph(String(text || ''))] })
        )
      })
    );
  });

  const doc = new Document({
    sections: [{
      children: [new Paragraph("采购报价比价结果"), new Table({ rows: tableRows })]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, '报价数据.docx');
});

// 初始化
showExchangeRates();
loadSavedData();
