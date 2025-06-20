const Home = require("../models/Home");
const deleteFile = require("../util/file"); // <-- import deleteFile utility

exports.getAddHome = (req, res, next) => {
  res.render("host/edit-home", {
    editing: false,
    pageTitle: "Host Your Home",
    isLoggedIn: req.session.isLoggedIn,
    user: req.session.user,
  });
};

exports.getEditHome = (req, res, next) => {
  const homeId = req.params.homeId;
  const editing = req.query.editing === "true";
  if (!editing) {
    console.log("Editing flag not set properly");
    return res.redirect("/host/host-homes");
  }

  Home.findById(homeId).then((home) => {
    if (!home) {
      console.log("Home not found for editing");
      return res.redirect("/host/host-homes");
    }

    console.log(homeId, editing, home);
    res.render("host/edit-home", {
      home: home,
      editing: editing,
      pageTitle: "Edit Your Home",
      isLoggedIn: req.session.isLoggedIn,
      user: req.session.user,
    });
  });
};

exports.postAddHome = (req, res, next) => {
  const { houseName, price, location, rating, description } = req.body;
  console.log('Req body', req.body);
  console.log('House Photo', req.file);

  if (!req.file) {
    return res.status(400).send('No valid image provided');
  }

  const photoUrl = "/" + req.file.path.replace(/\\/g, "/");

  const newHome = new Home({
    houseName,
    price,
    location,
    rating,
    photoUrl,
    description,
    host: req.session.user._id,
  });

  newHome.save().then(() => {
    res.redirect("/host/host-homes");
  }).catch(err => {
    console.error(err);
    next(err);
  });
};

exports.postEditHome = (req, res, next) => {
  const { id, houseName, price, location, rating, description } = req.body;
  console.log('Req body', req.body);
  console.log('House Photo', req.file);

  Home.findById(id)
    .then((existingHome) => {
      if (!existingHome) {
        console.log("Home not found for editing");
        return res.redirect("/host/host-homes");
      }
      existingHome.houseName = houseName;
      existingHome.price = price;
      existingHome.location = location;
      existingHome.rating = rating;

      if (req.file) {
        // Delete old photo from server
        deleteFile(existingHome.photoUrl.substring(1));
        // Update to new photo URL
        existingHome.photoUrl = "/" + req.file.path.replace(/\\/g, "/");
      }

      existingHome.description = description;
      return existingHome.save();
    })
    .then(() => {
      res.redirect("/host/host-homes");
    })
    .catch(err => {
      console.error(err);
      next(err);
    });
};

exports.postDeleteHome = (req, res, next) => {
  const homeId = req.params.homeId;
  console.log("Came to delete ", homeId);
  Home.findByIdAndDelete(homeId)
    .then(() => {
      res.redirect("/host/host-homes");
    })
    .catch(err => {
      console.error(err);
      next(err);
    });
};

exports.getHostHomes = (req, res, next) => {
  Home.find({ host: req.session.user._id }).then((registeredHomes) => {
    console.log(registeredHomes);
    res.render("host/host-homes", {
      homes: registeredHomes,
      pageTitle: "Host Homes",
      isLoggedIn: req.session.isLoggedIn,
      user: req.session.user,
    });
  }).catch(err => {
    console.error(err);
    next(err);
  });
};
