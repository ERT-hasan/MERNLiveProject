const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const sendGrid = require('@sendgrid/mail');
const {
  firstNameValidation,
  lastNameValidation,
  emailValidation,
  confirmPasswordValidation,
  passwordValidation,
  userTypeValidation,
  termsValidation,
} = require('./validations');

const MILLIS_IN_MINUTE = 60 * 1000;

const SEND_GRID_KEY = process.env.SENDGRID_API_KEY;
sendGrid.setApiKey(SEND_GRID_KEY);

exports.getLogin = (req, res, next) => {
  res.render('auth/login', { pageTitle: 'Login', isLoggedIn: false });
};

exports.getForgotPassword = (req, res, next) => {
  res.render('auth/forgot', { pageTitle: 'Forgot Password', isLoggedIn: false });
};

exports.getResetPassword = (req, res, next) => {
  const { email } = req.query;
  res.render('auth/reset_password', {
    pageTitle: 'Reset Password',
    isLoggedIn: false,
    email: email,
    errorMessages: [],
  });
};

exports.postResetPassword = [
  // Password Validator
  check('password')
    .trim()
    .isLength({ min: 8 })
    .withMessage('Password should be minimum 8 characters')
    .matches(/[a-z]/)
    .withMessage('Password should have at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password should have at least one uppercase letter')
    .matches(/[!@#$%^&*_":?]/)
    .withMessage('Password should have at least one special character'),

  // Confirm Password Validator
  check('confirm_password')
    .trim()
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Confirm Password does not match Password');
      }
      return true;
    }),

  async (req, res, next) => {
    const { email, otp, password } = req.body;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).render('auth/reset_password', {
        pageTitle: 'Reset Password',
        isLoggedIn: false,
        email: email,
        errorMessages: errors.array().map((err) => err.msg),
      });
    }

    try {
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error('User not found');
      }
      if (!user.otp || user.otpExpiry < Date.now()) {
        throw new Error('OTP expired or not found');
      }
      if (user.otp !== otp) {
        throw new Error('OTP does not match');
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      user.password = hashedPassword;
      user.otp = undefined;
      user.otpExpiry = undefined;
      await user.save();

      res.redirect('/login');
    } catch (err) {
      console.log(err);
      res.status(422).render('auth/reset_password', {
        pageTitle: 'Reset Password',
        isLoggedIn: false,
        email: email,
        errorMessages: [err.message],
      });
    }
  },
];

exports.postForgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('User not found');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = Date.now() + 30 * MILLIS_IN_MINUTE;
    await user.save();

    const forgotEmail = {
      to: email,
      from: process.env.FROM_EMAIL,
      subject: 'Here is your OTP to reset password',
      html: `<h1>OTP is ${otp}</h1>
             <p>Enter this OTP on <a href="http://localhost:3001/reset-password?email=${email}">Reset Password</a> page</p>`,
    };
    await sendGrid.send(forgotEmail);

    res.redirect(`/reset-password?email=${email}`);
  } catch (err) {
    console.log(err);
    res.status(422).render('auth/forgot', {
      pageTitle: 'Forgot Password',
      isLoggedIn: false,
      errorMessages: [err.message],
    });
  }
};

exports.getSignup = (req, res, next) => {
  res.render('auth/signup', { pageTitle: 'Signup', isLoggedIn: false });
};

exports.postLogin = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Password does not match');
    }

    req.session.isLoggedIn = true;
    req.session.user = user;
    await req.session.save();

    res.redirect('/');
  } catch (err) {
    console.log(err);
    res.status(422).render('auth/login', {
      pageTitle: 'Login',
      isLoggedIn: false,
      errorMessages: [err.message],
    });
  }
};

exports.postSignup = [
  firstNameValidation,
  lastNameValidation,
  emailValidation,
  passwordValidation,
  confirmPasswordValidation,
  userTypeValidation,
  termsValidation,

  async (req, res, next) => {
    console.log('User came for signup: ', req.body);
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).render('auth/signup', {
        pageTitle: 'Signup',
        isLoggedIn: false,
        errorMessages: errors.array().map((err) => err.msg),
        oldInput: req.body,
      });
    }

    const { firstName, lastName, email, password, userType } = req.body;

    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(422).render('auth/signup', {
          pageTitle: 'Signup',
          isLoggedIn: false,
          errorMessages: ['Email already registered'],
          oldInput: req.body,
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = new User({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        userType,
      });
      await user.save();

      const welcomeEmail = {
        to: email,
        from: process.env.FROM_EMAIL,
        subject: 'Welcome to our Airbnb',
        html: `<h1>Welcome ${firstName} ${lastName}! Please book your first vacation home with us.</h1>`,
      };
      await sendGrid.send(welcomeEmail);

      return res.redirect('/login');
    } catch (err) {
      console.log(err);
      return res.status(422).render('auth/signup', {
        pageTitle: 'Signup',
        isLoggedIn: false,
        errorMessages: [err.message],
        oldInput: req.body,
      });
    }
  },
];

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) console.log(err);
    res.redirect('/login');
  });
};
