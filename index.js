import express from 'express'
import cors from 'cors'

const app = express()

app.use(express.json())
app.use(cors())

const port = 5000;

app.get('/', (req, res) => {
    res.send({ messge: 'pizzahub connected' })
})

app.listen(port, () => {
    console.log(`PizzaHub backend On Server ${port}`);
})