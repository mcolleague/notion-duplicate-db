const { Client } = require('@notionhq/client')
const notion = new Client({ auth: process.env.NOTION_KEY })
const AWS = require('aws-sdk');

const taskIsSharedFilter = {
    or: [
        {
            property: "Is shared",
            formula: {
                checkbox: {
                    equals: true
                }
            }
        }
    ]
}
const dbsSearchObj = { 
    query: '', 
    filter: {
        property: 'object',
        value: 'database'
    }
}

const toClonedTaskDecorator = (inputs) => async ({ id: mainTaskId, properties }) => {
    const { sharedTasks, sharedTaskDBId } = inputs
    const existingClonedTask = sharedTasks.find(({properties}) => {
        return properties["Cloned from"]?.relation[0]?.id === mainTaskId
    })
    const clonedProps = [
        "Status",
        "Due",
        "Tags",
        "Project",
        "Theme",
        "Assignee",
    ].reduce((prev, key) => {
        const matchedProp = properties[key]
        const type = matchedProp?.type
        return matchedProp 
            ? { ...prev, [key]: {[type]: matchedProp[type]} }
            : prev
    }, {
        title: { 
            title: [
                {
                    "text": {
                        "content": properties.Name.title[0].plain_text
                    }
                }
            ]
        },
        "Cloned from": {
            relation: [
                {
                    id: mainTaskId        
                }
            ]
        }           
    })
    
    if (existingClonedTask) {
        await notion.pages.update({ 
            page_id: existingClonedTask.id, 
            properties: clonedProps
        })
    } else {
        await notion.pages.create({ 
            parent: { database_id: sharedTaskDBId }, 
            properties: clonedProps 
        })
    }
}

exports.handler = async (event, context, callback) => {
    const { results: dbsSearch } = await notion.search(dbsSearchObj)
    const getDBId = (dbTitle) => dbsSearch.find(({ title: [{ plain_text }]}) => plain_text === dbTitle).id
    const mainTaskDBId = getDBId("Tasks")
    const sharedTaskDBId = getDBId("Tasks (shared)")

    // Tasks in the main DB marked for sharing
    const { results: mainTasks } = await notion.databases.query({ 
        database_id: mainTaskDBId,
        filter: taskIsSharedFilter
    })

    // Tasks currently in the shared DB
    const { results: sharedTasks } = await notion.databases.query({
        database_id: sharedTaskDBId
    })

    const clonedTasks = await Promise.all(mainTasks.map(toClonedTaskDecorator(
        { sharedTasks, sharedTaskDBId }
    )))

    const msg = `Successfully synced ${clonedTasks.length} tasks`
    console.log(msg)
    return msg
}