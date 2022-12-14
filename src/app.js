import { MongoClient, ObjectId } from 'mongodb'
import { stripHtml } from "string-strip-html";
import express from 'express'
import dotenv from 'dotenv'
import dayjs from 'dayjs'
import cors from 'cors'
import joi from 'joi'

dotenv.config()

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
	db = mongoClient.db("bate-papo-uol");
});

const app = express()
app.use(cors())
app.use(express.json())

/*Estrutura
  participants
  {name: 'João', lastStatus: 12313123} // O conteúdo do lastStatus será explicado nos próximos requisitos
  messages
  {from: 'João', to: 'Todos', text: 'oi galera', type: 'message', time: '20:04:37'}
*/

const participantSchema = joi.object({
  name: joi.string().required()
})

const messagesSchema = joi.object({
  from: joi.string().required(),
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().valid('message', 'private_message'),
  time: joi.string().required()
})

setInterval(verifyParticipantsStatus, 15000)

async function verifyParticipantsStatus () {
  try {
    const participants = await db.collection('participants').find().toArray()
    participants.forEach(async (participant)=> {
      let nowStats = Date.now()
      let status = nowStats - participant.lastStatus
      if(status > 10000){
        let timeNow = `${dayjs().hour()}:${dayjs().minute()}:${dayjs().second()}`;
        await db.collection('participants').deleteOne({_id:ObjectId(participant._id)});
        await db.collection('messages').insertOne({
          from: participant.name, 
          to: 'Todos', 
          text: 'sai da sala...', 
          type: 'status', 
          time: timeNow
        })
      }
    });
  } catch (error) {
    console.log(error)
  }
}

app.post('/participants', async (req, res) => {

  const participantName = stripHtml(req.body.name).result
  const participant = {
    name: participantName.trim()
  }

  const validation = participantSchema.validate(participant)

  if(validation.error) {
    console.log(validation.error.details);
    res.status(422).send(validation.error.details[0].message)
    return;
  }

  try {

    const searchedParticipant = await db.collection('participants').find(participant).toArray();

    if(searchedParticipant.length > 0){
      res.sendStatus(409);
      return;
    }

    await db.collection('participants').insertOne({
      ...participant,
      lastStatus: Date.now()
    });

    let timeNow = `${dayjs().hour()}:${dayjs().minute()}:${dayjs().second()}`;

    await db.collection('messages').insertOne({
      from: participant.name, 
      to: 'Todos', 
      text: 'entra na sala...', 
      type: 'status', 
      time: timeNow
    })

    res.sendStatus(201)

  } catch (error) {
    console.log(error)
    res.sendStatus(500)
  }
});

app.get('/participants', async (req, res) => {
  try{
    const response = await db.collection('participants').find().toArray();
    res.send(response);
  }catch(error){
    console.log(error);
    res.sendStatus(500);
  }
});

app.post('/messages', async (req, res) => {
  const {to, text, type} = req.body
  const { user } = req.headers

  let timeNow = `${dayjs().hour()}:${dayjs().minute()}:${dayjs().second()}`;

  const message = {
    from: user,
    to,
    text,
    type,
    time: timeNow
  }

  try {

    const existentParticipant = await db.collection('participants').findOne({name:user})

    if(!existentParticipant){
      res.sendStatus(422)
      return;
    }

    const validation = messagesSchema.validate(message);

    if(validation.error){
      console.log(validation.error.details)
      res.sendStatus(422)
      return;
    }

    let sendMessage = {
      from: stripHtml(message.from).result.trim(),
      to: stripHtml(message.to).result.trim(),
      text: stripHtml(message.text).result.trim(),
      type: stripHtml(message.type).result.trim(),
      time: stripHtml(message.time).result.trim()
    }

    await db.collection('messages').insertOne(sendMessage)

    res.sendStatus(201);
    
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }

});

app.get('/messages', async (req, res) => {

  const { limit } = req.query

  try {
    const messages = await db.collection('messages').find().toArray();

    if(limit){
      let arrayMessages = messages.slice(-limit);
      res.send(arrayMessages);
      return;
    }else{
      res.send(messages)
    }

  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.post('/status', async (req, res) => {
  const {user} = req.headers
  try{
    const participant = await db.collection('participants').findOne({name: user});
    if(!participant){
      res.sendStatus(404)
      return;
    }
    await db.collection('participants').updateOne({_id:ObjectId(participant._id)}, {$set: {lastStatus: Date.now()}})
    res.sendStatus(200)
  }catch(error){
    console.log(error)
    res.sendStatus(404)
  }
});

app.put('/messages/:messageId', async (req, res) => {
  let timeNow = `${dayjs().hour()}:${dayjs().minute()}:${dayjs().second()}`;

  const {to, text, type} = req.body

  const { user } = req.headers
  const { messageId } = req.params

  let newMessage = {
    from: user,
    to,
    text,
    type,
    time: timeNow
  }

  try {

    const existentParticipant = await db.collection('participants').findOne({name:user})

    if(!existentParticipant){
      res.sendStatus(422)
      return;
    }

    const validation = messagesSchema.validate(newMessage);

    if(validation.error){
      console.log(validation.error.details)
      res.sendStatus(422)
      return;
    }

    const message = await db.collection('messages').findOne({_id: ObjectId(messageId)})

    if(!message) {
      res.sendStatus(404)
      return;
    }

    if(message.from !== user){
      res.sendStatus(401);
      return;
    }

    newMessage = {
      from: stripHtml(newMessage.from).result.trim(),
      to: stripHtml(newMessage.to).result.trim(),
      text: stripHtml(newMessage.text).result.trim(),
      type: stripHtml(newMessage.type).result.trim(),
      time: stripHtml(newMessage.time).result.trim()
    }

    await db.collection('messages').updateOne({_id:ObjectId(messageId)}, {$set: newMessage});
    res.sendStatus(200);

  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }

})

app.delete('/messages/:messageId', async (req, res) => {
  const {user} = req.headers;
  const {messageId} = req.params;

  try {
    const message = await db.collection('messages').findOne({_id: ObjectId(messageId)})
    if(!message){
      res.sendStatus(404)
      return;
    }
    if(message.from !== user){
      res.sendStatus(401);
      return;
    }

    await db.collection('messages').deleteOne({_id: ObjectId(messageId)})
    res.sendStatus(200);

  } catch (error) {
    console.log(error);
    res.sendStatus(500)
  }

});

app.listen(5000, () => console.log("Listen on port 5000..."))