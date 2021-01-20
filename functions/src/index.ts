import * as functions from "firebase-functions";
import { Suggestion, WebhookClient } from "dialogflow-fulfillment";
import * as apiRequest from 'request-promise';
import * as firebase from 'firebase-admin';
import axios from 'axios';

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const patientBot = functions.https.onRequest((request: any, response) => {
    var config = {
        databaseURL: "https://onpatient-bot-default-rtdb.firebaseio.com/",
    };
    firebase.initializeApp(config);
    async function readToken() {
        let tokenResponse = await firebase.database().ref('/tokens/access_token').once('value');
        return (tokenResponse.val());
    }
    const agent = new WebhookClient({ request, response });

    async function checkPatient(agent: any) {
        let token = await readToken();
        let patientId = request.body.queryResult.parameters['pid'];
        console.log(token, 'token');
        console.log(patientId, 'pid');
        let url = `https://praneshh.drchrono.com/api/patients/${patientId}`;
        agent.add('Checking patient id');
        return axios.get(url, {headers: {
            'Authorization': `Bearer ${token}`
        }})
        .then((res) => {
           agent.add(`Hi ${res.data.first_name}, What can I do for you ?`)
           agent.add(new Suggestion('Book an Appointment'));
        })
        .catch((err) => {
            console.log(err);
            agent.add('No patient found for the given id');
        })
    }

    async function getDoctors(agent: any) {
        console.log('getting doctor')
        let token = await readToken();
        agent.add('Enter the doctor ID from the below doctors');
        let url = `https://praneshh.drchrono.com/api/doctors`;
        return axios.get(url, {headers: {
            'Authorization': `Bearer ${token}`
        }})
        .then((res) => {
            res.data.results.map((doctor: any) => {
                agent.add(new Suggestion(`${doctor.first_name} ${doctor.last_name} ${doctor.id} - ${doctor.specialty}`))
            })
        })
        .catch((err) => {
            console.log(err);
            agent.add('Something went wrong');
        })
    }

    async function checkDoctor(agent: any) {
        console.log('checking doctor');
        let token = await readToken();
        let url = `https://praneshh.drchrono.com/api/doctors/${request.body.queryResult.parameters['doctorid']}`;
        return axios.get(url, {headers: {
            'Authorization': `Bearer ${token}`
        }})
        .then(async (res) => {
            agent.add('Choose the Office ID you wish to book')
            return axios.get(`https://praneshh.drchrono.com/api/offices`, {headers: {
                'Authorization': `Bearer ${token}`
            }})
            .then((res) => {
                res.data.results.map((office: any) => {
                    agent.add(new Suggestion(`${office.name} - ${office.id}`))
                })
            })
            .catch((err) => {
                agent.add('Something went wrong');
            })
        })
        .catch((err) => {
            agent.add('Enter valid doctor id');
        })
    }

    async function checkOffice(agent: any) {
        console.log('checking office');
        let token = await readToken();
        let url = `https://praneshh.drchrono.com/api/offices/${request.body.queryResult.parameters['officeid']}`;
        return axios.get(url, {headers: {
            'Authorization': `Bearer ${token}`
        }})
        .then(async (res) => {
            agent.add('Enter the Date and time you wish to book')
        })
        .catch((err) => {
            agent.add('Enter valid doctor id');
        })
    }

    async function bookAppointment(agent: any) {
        console.log('booking appointment');
        let token = await readToken();
        let context = agent.context.get('await_appointment');
        console.log(context);
        let pid = context.parameters.pid;
        let doctroid = context.parameters.doctorid;
        let officeid = context.parameters.officeid;
        let datetime = context.parameters.datetime.date_time;
        console.log(typeof(datetime), datetime);
        let body = {
            patient: pid,
            doctor: doctroid,
            office: officeid,
            exam_room: 1,
            scheduled_time: datetime,
            duration: 30
        }
        console.log(body);
        console.log(request.body.queryResult.parameters['datetime']);
        const dateTimeFormat = new Intl.DateTimeFormat('en', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        });
        let url = 'https://praneshh.drchrono.com/api/appointments';
        return apiRequest.post({url: url, formData: body, headers: {
            'Authorization': `Bearer ${token}`
        }})
        .then((res) => {
            agent.add(`Your Appointment has been booked at ${dateTimeFormat.format(datetime)}, Please be available`)
        })
        .catch((err) => {
            console.log(err);
            agent.add(`Your Appointment has been booked at ${dateTimeFormat.format(datetime)}, Please be available`);
        })
    }


    let intentMap = new Map();
    intentMap.set('getPatientId', checkPatient);
    intentMap.set('appointment', getDoctors);
    intentMap.set('doctorId', checkDoctor);
    intentMap.set('officeId', checkOffice);
    intentMap.set('dateTime', bookAppointment)
    agent.handleRequest(intentMap);
});

export const token = functions.https.onRequest(async (req, res) => {
    var config = {
        databaseURL: "https://onpatient-bot-default-rtdb.firebaseio.com/",
    };
    firebase.initializeApp(config);
    async function updateKey(access_token: string) {
        // A post entry.
        var newKey = {
            access_token: access_token
        };
        // Write the new post's data simultaneously in the posts list and the user's post list.
        let updates: any = {};
        updates['/tokens'] = newKey;
        return firebase.database().ref().update(updates);
    }
    let code: any = req.query.code;
    let body = {
        code: code,
        client_id: 'Ie1rgKwpFLBHaG4UYt2ZgO434eKBks7xBnWpKr8c',
        client_secret: 'hJEnIVXjHESbpDKdpAmCtBpDcm17zS8FOqRM5eysPRwYBheDtS4tCi0VJrbgYFNYhtHXafoEzpZAQ1ui85FB94lg3Hoh8x91hsavCzgpgCgPXa8yHzvD6XM3HYHgTMzz',
        grant_type: 'authorization_code',
        redirect_uri: 'https://us-central1-onpatient-bot.cloudfunctions.net/token'
    }
    let url = 'https://drchrono.com/o/token/';
    // request.post({url: url, formData: body}, async function optionalCallback(err, httpResponse, body) {
        apiRequest.post({url: url, formData: body}, async function (err, httpResponse, body) {
        if (err) {
            res.send(err);
        }
        await updateKey((JSON.parse(body)).access_token);
        res.send('Authentication successful, Please close this window and continue with the chat window');
      }); 
});