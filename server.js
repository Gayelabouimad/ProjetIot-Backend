// importing the express module
var express = require('express');
// creating the app
var app = express();
// Required to parse json
var body_parser= require('body-parser');
app.use(body_parser.json());

// --------------------------------------
// Connection to MQTT Broker
var mqtt = require('mqtt');

// Client Connection
var client = mqtt.connect('http://212.98.137.194:1883', {"username": "user", "password": "bonjour"})



var MGresponse;
var database;


//Updating the data
async function Update(msg){
     try{
        id=msg.devEUI;
        const collection1 = await database.collection("Energy_Consumption");
        // const item1 = await collection1.find().toArray();
        const collection2 = await database.collection("Classrooms");
        // const item2 = await collection2.find().toArray();
        var hours;
        // for (i in item1){
        //     if(item1[i].Device_EUI=id){
        //         hours=item1[i].NbHours + 1;
        //     }
        // }
        var lampes;
        // for (i in item2){
        //     if(item2[i].Device_EUI=id){
        //         lampes=item2[i].NbLampes;
        //     }
        // }
        var old_obj_EC = await collection1.findOne({Device_EUI: id});
        var old_obj_Classrooms = await collection2.findOne({Device_EUI: id});
        hours = old_obj_EC.NbHours + 1;
        lampes = old_obj_Classrooms.NbLampes;

        let cons = hours*lampes*36/1000;

        var today = (new Date()).toLocaleDateString();

        if(await collection1.findOne({Device_EUI: id, Date: today})){
            console.log("found it");
            const update = await collection1.update({Device_EUI: id}, {$set :{NbHours: hours, Consumption: cons}});
            if(update){
                console.log("update worked");
            }else{
                console.error("update not working");
            }
            return update;

        }else{
            var myobj = { 
                NumSalle: old_obj_EC.NumSalle, 
                Date: today,
                NbHours: 1,
                Consumption: lampes*36/1000,
                Device_EUI: id
            };
            collection1.insertOne(myobj, function(err, res) {
              if (err) throw err;
              console.log("1 document inserted");
              return "1 document inserted";
            });
        }
        
    }catch(err){
        return err;
    }
}
async function Update_2(msg,b){
    try{
       id=msg.devEUI;
       const collection = await database.collection("Classrooms");
       const update= await collection.update({Device_EUI: id}, {$set :{isOn:b}});
       if(update){
           console.log("update worked");
       }else{
           console.error("update not working");
       }
       return update;
       
   }catch(err){
       return err;
   }
}

var sensor_state = "Sensor State N/A";

function Respond_to_MQTT(){
    var today = new Date();
    // var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    if(today.getHours() < 21 && today.getHours() > 7){
        console.log("Sensor should be Up");
        let base64data = Buffer.from("100").toString('base64');
        var object_to_send = {
            "confirmed": false,
            "fPort": 1,                            
            "data": base64data
        };
        console.log("object to be sent", object_to_send);
        client.publish("application/19/device/804a2bad98eef9b1/tx", JSON.stringify(object_to_send));
        sensor_state = "Sensor is up";
    }
    sensor_state = "Sensor is down";
}

// On connection performed
client.on('connect', function () {
    console.log("Connected");
    // Client Subscription to Topic
    client.subscribe('application/19/device/804a2bad98eef9b1/rx', function (err) {
        console.log("Subscribed");
        if(err){
            console.log("error");
        }
    })
})
// When someone else publishes data
client.on('message', function (topic, message) {
    // message is Buffer
    let message_str = JSON.parse(message.toString());
    // console.log(message_str);
    value = message_str.object.payload;
    // Response to Arduino containing time
    Respond_to_MQTT();
    // client.end()
    try{
        // if the lamp is On
        
        if(value < 3){
            Update(message_str,10).then((result) => {
                console.log("result", result);
            });
            Update_2(message_str,true).then((result) => {
                console.log("i am in .then");
            });
        }
        else {
            Update_2(message_str,false).then((result) => {
                console.log("i am in .then");
            });
        }

    }catch(err){
        console.log(err)
    }
}
)
// --------------------------------------

async function GetData (CollName){
    try{
        const collection = await database.collection(CollName);
        const item = await collection.find().toArray();
        return item;
    }catch(err){
        return err;
    }
}
// Client connection to MongoDbd

// Main Route
app.get('/', function(req, res){
    res.send("Hello from root - " + sensor_state);
});

// Testing Route
app.get('/test', function(req, res){
    res.send("Hello from test");
});

// Get all the rows in Classrooms Collection
app.get("/getClassrooms", function(req, res){
    try{
        GetData("Classrooms").then((data) => {
            res.send(data);
        })
    }catch(err){
        res.send(err)
    }
});

// Get all the rows in Energy_Consumption Collection
app.get("/getEnergyConsumption", function(req, res){
    try{
        GetData("Energy_Consumption").then((data) => {
            res.send(data);
        })
    }catch(err){
        res.send(err)
    }
});

app.listen(3000, "localhost" , async () => {
    console.log("Listening on port: ", 3000);
    MongoClient = require('mongodb').MongoClient;
    DBConnectionString = 'mongodb+srv://admin:admin@cluster0-p5xwn.mongodb.net/test?retryWrites=true&w=majority';
    try{
        MGresponse = await MongoClient.connect(DBConnectionString, 
            {
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        database = await MGresponse.db("IoT_Data");
        if(database){
            console.log("Database connected");
        }
        else{
            console.log("Connection error to database");
        }
    }catch(err){
        return err;
    }
});
