import connectDB from './db/index.js';
import { server } from './app.js';
import config from './config/config.js';
import { bookingExpirationScheduler } from './services/booking/bookingExpirationScheduler.service.js';

connectDB()
  .then(() => {
    server.listen(config.PORT || 8000, () => {
      console.log(`⚙️ Server is running at port : ${config.PORT}`);
      bookingExpirationScheduler.start();
    });
  })
  .catch((err) => {
    console.log('MONGO db connection failed !!! ', err);
  });
