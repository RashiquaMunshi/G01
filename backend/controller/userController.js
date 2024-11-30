const User = require('../model/User');
const {comparePassword,hashPassword} = require('../utils/passwordUtils');
const crypto = require('crypto');
const { redisClient} = require('../config/redisdatabase');
const {sendOTPEmail}= require('../services/OTPservice');
const { promisify } = require('util');
require('dotenv').config();

exports.sendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        const otp = crypto.randomInt(100000, 999999).toString();

        await redisClient.set(email, otp,{EX:10*60});  

        sendOTPEmail({
            email,
            OTP: otp
        });

        res.status(200).json({ success: true, message: "OTP sent to your email" });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const redotp = await redisClient.get(email);
        if (redotp === String(otp)) {
            redisClient.del(email);
            return res.status(200).json({ success: true, message: "OTP verified successfully" });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Error verifying otp" });
    }
};

exports.createUser = async (req, res) => {
    try {
        let { userId, name, email, password,  pin } = req.body;  // Use 'let' instead of 'const'

        const existingUser = await User.findOne({ userId });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        const dailyLimit = 100; 
        const transactions = [];
        const usedCoupons = [];
        const balance=0;
        const role="Student";
        // Hash the password and pin before saving
        password = await hashPassword(password);
        pin = await hashPassword(pin);

        const newUser = new User({
            userId, name, role, email, password, balance, pin, dailyLimit, transactions, usedCoupons
        });

        await newUser.save();
        res.status(200).json({ success: true, message: "User created successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const { userId } = req.user;  // Extract userId from token/session
        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new password are required' });
        }

        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const passwordCheck = await comparePassword(currentPassword, user.password);
        if (!passwordCheck) {
            return res.status(401).json({ message: "Current password is incorrect" });
        }

        // Hash and update the new password
        user.password = await hashPassword(newPassword);
        await user.save();

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};


exports.updatePin = async (req, res) => {
    try {
        const { userId } = req.user;  // Extract userId from token/session
        const { currentPin, newPin } = req.body;

        // Validate input
        if (!currentPin || !newPin) {
            return res.status(400).json({ message: 'Current and new PIN are required' });
        }

        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the current PIN is correct
        const isPinValid = comparePassword(currentPin.toString(), user.pin);
        if (!isPinValid) {
            return res.status(401).json({ message: "Current password is incorrect" });
        }

        // Hash and update the new PIN
        user.pin = await hashPassword(newPin.toString()); 
        await user.save();

        res.status(200).json({ message: 'PIN updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

exports.getUserTransactions = async (req, res) => {
    try {
        const { userId } = req.body;

        const user = await User.findOne({ userId }).populate({
            path: 'transactions',
        });

        if (!user) {
            return res.status(404).send({ error: 'User not found.' });
        }

        const last20Transactions = user.transactions.slice(-20);

        res.status(200).send({ transactions: last20Transactions });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};

exports.getUserWithoutTransactions = async (req, res) => {
    try {
        const { userId } = req.body;

        const user = await User.findOne({ userId }, '-transactions -usedCoupons');

        if (!user) {
            return res.status(404).send({ error: 'User not found.' });
        }

        res.status(200).send({ user });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};
