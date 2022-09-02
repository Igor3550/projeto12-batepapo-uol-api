import { MongoClient } from 'mongodb'
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

app.post('/status', (req, res) => {
  res.send('status')
})
app.listen(5000, () => console.log("Listen on port 5000..."))