import { Wallet } from '../../models/index.js';

class WalletService {
  async getWallet(userId, userType, session) {
    const wallet = await Wallet.findOne({ userId, userType }).session(session);
    if (!wallet) throw new Error(`${userType.toUpperCase()}_WALLET_NOT_FOUND`);
    return wallet;
  }

  async getAdminWallet(userType, session) {
    const wallet = await Wallet.findOne({ userType }).session(session);
    if (!wallet) throw new Error(`${userType.toUpperCase()}_WALLET_NOT_FOUND`);
    return wallet;
  }

  async deductCommission({ vendorId, amount, session }) {
    const wallet = await this.getWallet(vendorId, 'Vendor', session);

    if (wallet.balance < amount) throw new Error('INSUFFICIENT_BALANCE');

    wallet.balance -= amount;
    wallet.totalSpent += amount;
    await wallet.save({ session });

    return wallet;
  }

  async creditAdminCommission({ amount, session }) {
    const wallet = await this.getAdminWallet('Admin', session);
    wallet.balance += amount;
    wallet.totalEarned += amount;
    await wallet.save({ session });

    return wallet;
  }

  async credit(wallet, amount, session) {
    const prev = wallet.balance;
    wallet.balance += amount;
    await wallet.save({ session });
    return { prev, current: wallet.balance };
  }

  async debit(wallet, amount, session) {
    const prev = wallet.balance;
    wallet.balance -= amount;
    await wallet.save({ session });
    return { prev, current: wallet.balance };
  }

  async addRecentTransaction(wallet, txnId, session) {
    wallet.recentTransactions.unshift(txnId);
    wallet.recentTransactions = wallet.recentTransactions.slice(0, 10);
    await wallet.save({ session });
  }
}

const walletService = new WalletService();

export { walletService };
