const express = require("express");
const app = express();
const bodyParser = require("body-parser");
app.use(bodyParser.json());
const path = require("path");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "./public")));
var cookieParser = require("cookie-parser");
app.use(cookieParser());
// app.use(cookieParser());
var multer = require("multer");
app.set("view engine", "ejs");
var mongo = require("mongodb");
var db = require("./db.js");
var fs = require("fs");
const User = require("./userModel");
db();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const auth = require("./auth");
const { spawn } = require("child_process");
const { check, validationResult } = require("express-validator");

//loginpage
app.get("/", (req, res) => {
  if (req.cookies.id) {
    const id = req.cookies.id;
    User.findOne({ _id: id }, function (err, user) {
      //find the post base on post name or whatever criteria

      if (err) console.log(err);
      else {
        res.redirect("/home");
      }
    });
  } else {
    res.render("login");
  }
});
app.post("/", (req, res) => {
  User.findOne({ email: req.body.email })

    // if email exists
    .then((user) => {
      // compare the password entered and the hashed password found
      bcrypt
        .compare(req.body.password, user.password)

        // if the passwords match
        .then((passwordCheck) => {
          // check if password matches
          if (!passwordCheck) {
            res.render("login", { message: "password is incorrect" });
            //     return res.status(400).send({
            //       message: "Passwords does not match",
            //       error,
            // });
          }

          //   create JWT token
          const token = jwt.sign(
            {
              userId: user._id,
              userEmail: user.email,
            },
            "RANDOM-TOKEN",
            { expiresIn: "24h" }
          );

          //   return success response
          res.cookie("id", user._id);
          res.redirect("/home");
        })
        // catch error if password do not match
        .catch((error) => {
          res.render("login", { message: "password is incorrect" });
        });
    })
    // catch error if email does not exist
    .catch((e) => {
      res.render("login", { message: "email does not exist" });
    });
});

//signup
app.get("/signup", (req, res) => {
  res.render("signUp");
});

app.post(
  "/signup",
  [
    check("email", "Invalid Email").isEmail(),
    // check('confirmPassword', 'Passwords do not match').custom(( value,{req}) => (req.body.confirmpassword !== req.body.password)),
    check("name", "Name is required").not().isEmpty(),
    check("username", "Username is required").not().isEmpty(),
    check("address", "Address is required").not().isEmpty(),
    check("password", "Password is required").not().isEmpty(),
    check("gender", "gender field required").not().isEmpty(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (req.body.password != req.body.confirmpassword) {
      errors.push("Passwords do not match");
    }
    if (!errors.isEmpty()) {
      console.log(req.body.password, req.body.confirmpassword);
      const alert = errors.array();
      res.render("signUp", { alert });
    } else {
      bcrypt
        .hash(req.body.password, 10)
        .then((hashedPassword) => {
          // create a new user instance and collect the data
          const user = new User({
            email: req.body.email,
            password: hashedPassword,
            phone: req.body.phone,
            address: req.body.address,
            name: req.body.name,
            username: req.body.username,
            gender: req.body.gender,
          });

          // save the new user
          user
            .save()
            // return success if the new user is added to the database successfully
            .then((result) => {
              res.render("login");
            })
            // catch erroe if the new user wasn't added successfully to the database
            .catch((error) => {
              console.log(error);

              res.status(500).send({
                message: "Error creating user",
                error,
              });
            });
        })
        // catch error if the password hash isn't successful
        .catch((e) => {
          console.log(e);
          res.status(500).send({
            message: "Password was not hashed successfully",
            e,
          });
        });
    }
  }
);

//home
app.get("/home", (req, res) => {
  if (req.cookies.id) {
    const id = req.cookies.id;
    User.findOne({ _id: id }, function (err, user) {
      //find the post base on post name or whatever criteria

      if (err) res.render("login");
      else {
        let reqs = [];
        let follow=[];
        if (user.requests.length != 0) {
          var bar = new Promise((resolve, reject) => {
            user.requests.forEach(function (singleUser, index, array) {
              User.find({ _id: singleUser.userid }, function (err, user) {
                if (err) console.log(err);
                else {
                  reqs.push(user[0]);
                  
                  if (index === array.length - 1) resolve();
                  return reqs;
                }
              });
            });
            
           
          });
          
          bar.then(() => {
            
            
            res.render("home", { user: user, requests: reqs,follow:follow });
          });
        } else {
          res.render("home", { user: user, requests: [] ,follow:[]});
        }
      }
    });
  } else {
    res.render("login");
  }
});
app.post("/addpost", (req, res) => {
  if (req.cookies.id) {
    const id = req.cookies.id;
    User.findOne({ _id: id }, function (err, user) {
      //find the post base on post name or whatever criteria

      if (err) res.render("login");
      else {
        var text = req.body.text;
        user.textpost.push({
          text: text,
        });
        res.redirect("/home");

        user.save(function (err) {
          err != null ? console.log(err) : console.log("Data updated");
        });
      }
    });
  }
});

//findmybuddy
app.get("/findmybuddy", (req, res) => {
  if (req.cookies.id) {
    const id = req.cookies.id;
    User.findOne({ _id: id }, function (err, user) {
      //find the post base on post name or whatever criteria

      if (err) res.render("login");
      else {
        res.render("findBuddy", { user: user });
      }
    });
  }
});

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/uploads");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});
var upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
//createpost
app.get("/createpost", (req, res) => {
  if (req.cookies.id) {
    const id = req.cookies.id;
    User.findOne({ _id: id }, function (err, user) {
      //find the post base on post name or whatever criteria

      if (err) res.render("login");
      else {
        res.render("createPost", { user: user });
      }
    });
  }
});
0;
app.get("/profile", (req, res) => {
  if (req.cookies.id) {
    const id = req.cookies.id;
    User.findOne({ _id: id }, function (err, user) {
      //find the post base on post name or whatever criteria

      if (err) res.render("login");
      else {
        res.render("profile", { user: user });
      }
    });
  }
});


app.post("/addimage", upload.single("filename"), (req, res, next) => {
  if (req.cookies.id) {
    const id = req.cookies.id;
    User.findOne({ _id: id }, function (err, user) {
      //find the post base on post name or whatever criteria

      if (err) res.render("login");
      else {
        // try {
        if (!req.file) {
          console.log("Please select an image file");
        } else {
          const filepath = `public/uploads/${req.file.filename}`;
          console.log(filepath);
          let image = {};
          image["file"] = filepath;
          console.log(image);
          res.cookie("image", image);
          const path = `/uploads/${req.file.filename}`;
          res.render("createPost", { path: path, user: user });
          return;
        }
      }
    });
  }
});

app.post("/generate", (req, res) => {
  if (req.cookies.id) {
    const id = req.cookies.id;
    User.findOne({ _id: id }, function (err, user) {
      //find the post base on post name or whatever criteria

      if (err) res.render("login");
      else {
        if (req.cookies.image) {
          cook = req.cookies.image;
          const filepath = req.cookies.image["file"];
          console.log(filepath);
          const python = spawn("python", [
            "caption generation/imagecaption.py",
            filepath,
          ]);
          python.stdout.on("data", function (data) {
            cook["caption"] = data.toString();
            res.cookie("image", cook);
            console.log(data.toString().match(/\b(\w+)\b/g));
            res.render("createPost", {
              path: filepath.slice(7),
              caption: data.toString().match(/\b(\w+)\b/g),
              user: user,
            });
            return;
          });
        } else {
          console.log("error");
        }
      }
    });
  }
});

app.post("/classify", (req, res) => {
  if (req.cookies.id) {
    const id = req.cookies.id;
    User.findOne({ _id: id }, function (err, user) {
      //find the post base on post name or whatever criteria

      if (err) res.render("login");
      else {
        if (req.cookies.image) {
          cook = req.cookies.image;
          const filepath = req.cookies.image["file"];
          console.log(filepath);
          const python = spawn("python", [
            "classification/predict.py",
            filepath,
          ]);
          python.stdout.on("data", function (data) {
            console.log(data.toString())
            const myArray = data.toString().split("++");
            cook["caption"] = myArray[1];
            cook["class"] = myArray[0];
            cook['url']=myArray[6];
          const altcap =[myArray[2],myArray[3],myArray[4],myArray[5]];


            res.cookie("image", cook);
            // console.log(myArray[2]);

            res.render("createPost", {
              path: filepath.slice(7),
              captioncrawl: myArray[1],
              classify: myArray[0],
              url:myArray[6],
              user: user,
              altcap:altcap
            });
            return;
          });
        } else {
          console.log("error");
        }
      }
    });
  }
});

app.post("/altcap", (req, res) => {
  if (req.cookies.id) {
    const id = req.cookies.id;
    User.findOne({ _id: id }, function (err, user) {
      //find the post base on post name or whatever criteria

      if (err) res.render("login");
      else {
        if (req.cookies.image) {
          cook = req.cookies.image;
          const filepath = req.cookies.image["file"];
          const altcap=req.body.altcaption;
          res.cookie("image", cook);
          res.render("createPost", {
            path: filepath.slice(7),
            user: user,
            newcap:altcap
          });
          return;
        }
      }
    });
  }
});


app.get("/msg", (req, res) => {
  if (req.cookies.id) {
    const id = req.cookies.id;
    User.findOne({ _id: id }, function (err, user) {
      //find the post base on post name or whatever criteria

      if (err) res.render("login");
      else {
        chat = user.chat;
        var id=req.query.userid
        var msg = chat.find(({ userid }) => userid === req.query.userid);
        
        
        res.cookie('oppuser',id)
        res.render("message", { message: msg.message, id: id ,msg:msg,user:user});
      }
    });
  }
});

app.post("/sendmessage", (req, res) => {
  if (req.cookies.id) {
    const id = req.cookies.id;
    User.findOne({ _id: id }, function (err, user) {
      //find the post base on post name or whatever criteria

      if (err) res.render("login");
      else {
        var oppuser = req.cookies.oppuser;
        console.log(oppuser)
        var text = req.body.text;
        chat = user.chat;
        var msg = chat.find(({ userid }) => userid === oppuser);
        
        msg.message.push({
          content: text,
          sent:true

        });
        user.save(function (err) {
          err != null ? console.log(err) : console.log("Data updated");
        });
        var msg = chat.find(({ userid }) => userid === oppuser);
        User.findOne({_id:oppuser},function(err,opuser){
          if(err) res.render("message");
          else{
            
            var opmsg=opuser.chat.find(({userid})=>userid===id);
            
            opmsg.message.push({
              content:text,
              sent:false
            });
            opuser.save(function (err) {
              err != null ? console.log(err) : console.log("Data updated");
            });
          }
        })
        res.render("message", {user:user,msg:msg,message: msg.message });
      }
    });
  }
});

app.post("/post", (req, res) => {
  if (req.cookies.id) {
    console.log(req.body)
    const id = req.cookies.id;
    User.findOne({ _id: id }, function (err, user) {
      //find the post base on post name or whatever criteria

      if (err) res.render("login");
      else {
        image = req.cookies.image;
        console.log(image);
        if(req.body.own){
          var caption=req.body.own;
        }
        else{
        var caption=image["caption"];
        }
        user.post.push({
          img: image["file"],
          finalcaption:caption,
          class: image["class"],
          location: image["location"],
        });
        res.clearCookie("image");
        res.redirect("/home");

        user.save(function (err) {
          err != null ? console.log(err) : console.log("data added");
        });
      }
    });
  }
});

app.post("/delete", (req, res) => {
  const delPost = req.body.deletePost;
  User.findOne({ _id: delPost }, function (err, user) {
    if (err) res.render("login");
    else {
      console.log("del");
    }
  });
});

app.get("/req", (req, res) => {
  // console.log(req.params.topic);
  const postId = req.query.accept;
  if (req.cookies.id) {
    const id = req.cookies.id;
    User.findOne({ _id: id }, function (err, user) {
      if (!err) {
        user.followers.push({
          userid: postId,
        });
        user.chat.push({
          userid:postId,
          name:req.query.name
        })
        user.save(function (err) {
          err != null ? console.log(err) : console.log("Data updated");
        });
        
        const pullTodo = { $pull: { requests: { userid: postId } } }
        User.findOneAndUpdate({ _id:id},pullTodo, {new: true}, function (err, user) {
          console.log("1 document deleted");
        });
          
        
       
      
    }})
    User.findOne({ _id: postId }, function (err, user) {
      if (!err) {
        user.followers.push({
          userid: id,
        });
        user.chat.push({
          userid:id,
          name:req.query.name
        })
        user.save(function (err) {
          err != null ? console.log(err) : console.log("Data updated");
        });
        
        const pullTodo = { $pull: { requests: { userid: id } } }
        User.findOneAndUpdate({ _id:postId},pullTodo, {new: true}, function (err, user) {
          console.log("1 document deleted");
        });
          
        
        res.redirect("/home");
      
    }})
    }
    
    });
app.get("/follow", (req, res) => {
  // console.log(req.params.topic);
  const postId = req.query.userid;
  if (req.cookies.id) {
    const id = req.cookies.id;
    User.findOne({ _id: postId }, function (err, user) {
      if (!err) {
        user.requests.push({
          userid: id,
        });
        user.save(function (err) {
          err != null ? console.log(err) : console.log("Data updated");
        });
        
        res.redirect("/home");
      }
    });
  }
});

app.post("/cuisine", (req, res) => {
  const cuis = req.body.cuisine;
  // console.log(cuis);
  User.findOne({ _id: req.cookies.id }, function (err, user) {
    if (!err) {
      user.cuisine=cuis;
      user.save(function (err) {
        err != null ? console.log(err) : console.log("Data updated");
      });
  User.find({ cuisine: cuis }, function (err, user) {
    if (!err) {
      res.render("findBuddy", { prof: user });
    }
  });
}
});
});

app.get('/logout',(req,res)=>{
  res.clearCookie("id");
  res.render('login');
})

app.listen(3000, function () {
  console.log("listening on 3000");
});
module.exports = app;
