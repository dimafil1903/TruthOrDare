const Reverso = require('reverso-api');
const reverso = new Reverso();
const axios = require('axios')
const fs = require('fs');

let type = `truth`;
if (type=='truth'){
    mytype=type
}else {
    mytype='dare'
}
for (let i = 0; i < 500; i++)
 axios
        .post('https://randommer.io/truth-dare-generator?category=friendly&type=' + mytype)
        .then(res => {
            if (res.data.text)
                reverso.getTranslation(res.data.text, 'English', 'Russian').then(
                    setTimeout(response => {
                    console.log(response.translation);
                    let rawdata = fs.readFileSync('questions.json');
                    let q = JSON.parse(rawdata);

                    let i = parseInt(q[q.length-1].id)+1
                    console.log(q.length)
                    let str1 = String(response.translation[0]);

                    let founded = q.find(x => x.question === str1);
                    console.log(founded)
                    if (founded === undefined) {
                        q.push(
                            {
                                id: `${i}`,
                                category_id: "5",
                                type: type,
                                question: str1,
                                gender: "0",
                                active: "0"

                            }
                        )
                        let data = JSON.stringify(q, null, 2);
                        fs.writeFileSync('questions.json', data)
                    }

                },500)).catch(err => {
                    return console.error(err);
                });
        })

