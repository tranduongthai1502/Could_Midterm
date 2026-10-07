const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'hbs');
// 1. ĐA LUỒNG KẾT NỐI MONGODB ATLAS
// Kết nối độc lập 2 tài khoản (Read và Write) gắn liền với MSSV 23IT249
const readConn = mongoose.createConnection(process.env.MONGODB_READ_URI);
const writeConn = mongoose.createConnection(process.env.MONGODB_WRITE_URI);

const bookSchema = new mongoose.Schema({
  productCode: String,
  name: String,
  priceOriginal: Number,
  priceWithVAT: Number
});

// Tự động điều hướng luồng truy vấn dựa trên Model gắn với connection tương ứng
const ReadBook = readConn.model('Book', bookSchema);
const WriteBook = writeConn.model('Book', bookSchema);
// 2. STATELESS SESSION TRÊN CLOUD
// Tuyệt đối không lưu Session trong RAM, lưu tập trung trực tiếp xuống MongoDB Atlas qua connect-mongo
app.use(session({
  secret: 'cloud-midterm-secret-23it249',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_WRITE_URI,
    collectionName: 'sessions'
  }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 ngày
}));

// 3. LOGIC XỬ LÝ & THUẬT TOÁN CÁ NHÂN HÓA
// Read: Lấy danh sách sách từ luồng Đọc
app.get('/', async (req, res) => {
  try {
    const books = await ReadBook.find({});
    res.render('index', { 
      books, 
      name: 'Trần Dương Thái', 
      mssv: '23IT249', 
      vat: '15%' // 
    });
  } catch (err) {
    res.status(500).send('Lỗi đọc dữ liệu: ' + err.message);
  }
});

// Write: Thêm mới sách qua luồng Ghi
app.post('/add-book', async (req, res) => {
  const { productCode, name, priceOriginal } = req.body;
  
  // Bộ lọc dữ liệu: Mã sản phẩm bắt buộc phải có tiền tố là 3 số cuối MSSV (249)
  if (!productCode || !productCode.startsWith('249')) {
    return res.status(400).send('Lỗi cá nhân hóa: Mã sản phẩm bắt buộc phải có tiền tố là 3 số cuối MSSV (249)!');
  }

  // Thuế suất động theo công thức mới: VAT = (Chữ số cuối MSSV + 6)% = (9 + 6)% = 15%
  const vatRate = 0.15;
  const priceWithVAT = Number(priceOriginal) * (1 + vatRate);

  try {
    // Tự động điều hướng luồng Ghi xuống đám mây qua tài khoản Ghi
    const newBook = new WriteBook({ 
      productCode, 
      name, 
      priceOriginal: Number(priceOriginal), 
      priceWithVAT 
    });
    await newBook.save();
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Lỗi ghi dữ liệu: ' + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng ${PORT}`);
});