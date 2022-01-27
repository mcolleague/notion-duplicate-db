const { Client } = require('@notionhq/client')
const notion = new Client({ auth: process.env.NOTION_KEY })
const AWS = require('aws-sdk');

const dbByTitleFilter = (str) => ({ title: [{plain_text}] }) => plain_text === str
const getTasksQueryObj = (dbId) => ({
    database_id: dbId,
    filter: {
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
})
const dbsSearchObj = { 
    query: '', 
    filter: {
        property: 'object',
        value: 'database'
    }
}
const cloneTaskToSharedDecorator = (database_id) => (task, i) => {
    const props = [
        "Status",
        "Due",
        "Tags",
        "Project",
        "Theme",
        "Assignee",
    ].reduce((prev, key) => {
        const matchedProp = task.properties[key]
        const type = matchedProp?.type
        return matchedProp 
            ? { ...prev, [key]: {[type]: matchedProp[type]} }
            : prev
    }, {
        title: { 
            title: [
                {
                    "text": {
                        "content": task.properties.Name.title[0].plain_text
                    }
                }
            ]
        }           
    })

    notion.pages.create({
        parent: { database_id },
        properties: props      
    })     
}

exports.handler = async (event, context, callback) => {
    const dbsSearch = await notion.search(dbsSearchObj)
    const dbs = dbsSearch.results
    const dbsMap = {
        tasks: {
            main: dbs.find(dbByTitleFilter("Tasks")).id,
            shared: dbs.find(dbByTitleFilter("Tasks (shared)")).id
        },
        projects: {
            main: dbs.find(dbByTitleFilter("Projects")).id
        },
        rules: {
            main: dbs.find(dbByTitleFilter("Rules")).id
        }
    }

    const tasksQueryObj = getTasksQueryObj(dbsMap.tasks.main)
    const tasksQuery = await notion.databases.query(tasksQueryObj)
    const tasks = tasksQuery.results

    tasks.forEach(cloneTaskToSharedDecorator(dbsMap.tasks.shared))
    return 'Success'
}