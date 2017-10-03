import {DataMapper} from "./DataMapper";
import {OnMissingStrategy, ReadConsistency} from "./constants";
import {
    DynamoDbSchema,
    DynamoDbTable,
} from "./protocols";
import {BinaryValue} from '@aws/dynamodb-auto-marshaller';
import {Schema} from "@aws/dynamodb-data-marshaller";
import {
    AttributePath,
    between,
    equals,
    FunctionExpression,
    inList,
} from "@aws/dynamodb-expressions";

describe('DataMapper', () => {
    describe('#delete', () => {
        const promiseFunc = jest.fn(() => Promise.resolve({Item: {}}));
        const mockDynamoDbClient = {
            deleteItem: jest.fn(() => ({promise: promiseFunc})),
        };

        beforeEach(() => {
            promiseFunc.mockClear();
            mockDynamoDbClient.deleteItem.mockClear();
        });

        const mapper = new DataMapper({
            client: mockDynamoDbClient as any,
        });

        it(
            'should use the table name specified in the supplied table definition',
            async () => {
                const tableName = 'foo';
                await mapper.delete({
                    item: {
                        [DynamoDbTable]() {
                            return tableName;
                        },
                        [DynamoDbSchema]() {
                            return {};
                        },
                    },
                });

                expect(mockDynamoDbClient.deleteItem.mock.calls[0][0])
                    .toMatchObject({TableName: tableName});
            }
        );

        it(
            'should apply a table name prefix provided to the mapper constructor',
            async () => {
                const tableNamePrefix = 'INTEG_';
                const mapper = new DataMapper({
                    client: mockDynamoDbClient as any,
                    tableNamePrefix,
                });
                const tableName = 'foo';
                await mapper.delete({
                    item: {
                        [DynamoDbTable]() {
                            return tableName;
                        },
                        [DynamoDbSchema]() {
                            return {};
                        }
                    },
                });

                expect(mockDynamoDbClient.deleteItem.mock.calls[0][0])
                    .toMatchObject({TableName: tableNamePrefix + tableName});
            }
        );

        it(
            'should marshall the supplied key according to the schema',
            async () => {
                await mapper.delete({
                    item: {
                        fizz: 'buzz',
                        pop: new Date(60000),
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Date',
                                    keyType: 'RANGE'
                                },
                            };
                        },
                    },
                });

                expect(mockDynamoDbClient.deleteItem.mock.calls[0][0])
                    .toMatchObject({
                        Key: {
                            fizz: {S: 'buzz'},
                            pop: {N: '60'},
                        }
                    });
            }
        );

        it(
            'should ignore non-key fields when marshalling the key',
            async () => {
                await mapper.delete({
                    item: {
                        fizz: 'buzz',
                        pop: new Date(60000),
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Date'
                                },
                            };
                        },
                    },
                });

                expect(mockDynamoDbClient.deleteItem.mock.calls[0][0])
                    .toMatchObject({
                        Key: {fizz: {S: 'buzz'}}
                    });
            }
        );

        it(
            'should apply attribute names when marshalling the key',
            async () => {
                await mapper.delete({
                    item: {
                        fizz: 'buzz',
                        pop: new Date(60000),
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    attributeName: 'foo',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Date'
                                },
                            };
                        },
                    },
                });

                expect(mockDynamoDbClient.deleteItem.mock.calls[0][0])
                    .toMatchObject({
                        Key: {foo: {S: 'buzz'}}
                    });
            }
        );

        it(
            'should include a condition expression when the schema contains a version attribute',
            async () => {
                await mapper.delete({
                    item: {
                        fizz: 'buzz',
                        pop: 21,
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    attributeName: 'foo',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Number',
                                    versionAttribute: true,
                                },
                            };
                        },
                    },
                });

                expect(mockDynamoDbClient.deleteItem.mock.calls[0][0])
                    .toMatchObject({
                        ConditionExpression: '#attr0 = :val1',
                        ExpressionAttributeNames: {'#attr0': 'pop'},
                        ExpressionAttributeValues: {':val1': {N: '21'}},
                    });
            }
        );

        it(
            'should not include a condition expression when the schema contains a version attribute but the value is undefined',
            async () => {
                await mapper.delete({
                    item: {
                        fizz: 'buzz',
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    attributeName: 'foo',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Number',
                                    versionAttribute: true,
                                },
                            };
                        },
                    },
                });

                expect(mockDynamoDbClient.deleteItem.mock.calls[0][0])
                    .not.toHaveProperty('ConditionExpression');
            }
        );

        it(
            'should not include a condition expression when the skipVersionCheck input parameter is true',
            async () => {
                await mapper.delete({
                    item: {
                        fizz: 'buzz',
                        pop: 21,
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    attributeName: 'foo',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Number',
                                    versionAttribute: true,
                                },
                            };
                        },
                    },
                    skipVersionCheck: true,
                });

                expect(mockDynamoDbClient.deleteItem.mock.calls[0][0])
                    .not.toHaveProperty('ConditionExpression');
            }
        );

        it(
            `should not include a condition expression when the mapper's default skipVersionCheck input parameter is true`,
            async () => {
                const mapper = new DataMapper({
                    client: mockDynamoDbClient as any,
                    skipVersionCheck: true
                });
                await mapper.delete({
                    item: {
                        fizz: 'buzz',
                        pop: 21,
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    attributeName: 'foo',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Number',
                                    versionAttribute: true,
                                },
                            };
                        },
                    },
                });

                expect(mockDynamoDbClient.deleteItem.mock.calls[0][0])
                    .not.toHaveProperty('ConditionExpression');
            }
        );

        it(
            'should combine the version condition with any other condition expression',
            async () => {
                await mapper.delete({
                    item: {
                        fizz: 'buzz',
                        pop: 21,
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    attributeName: 'foo',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Number',
                                    versionAttribute: true,
                                },
                                quux: {type: 'Date'},
                            };
                        },
                    },
                    condition: {
                        type: 'LessThan',
                        subject: 'quux',
                        object: 600000
                    }
                });

                expect(mockDynamoDbClient.deleteItem.mock.calls[0][0])
                    .toMatchObject({
                        ConditionExpression: '(#attr0 < :val1) AND (#attr2 = :val3)',
                        ExpressionAttributeNames: {
                            '#attr0': 'quux',
                            '#attr2': 'pop',
                        },
                        ExpressionAttributeValues: {
                            ':val1': {N: '600000'},
                            ':val3': {N: '21'}
                        },
                    });
            }
        );

        it('should unmarshall any returned attributes', async () => {
            promiseFunc.mockImplementation(() => Promise.resolve({Attributes: {
                fizz: {S: 'buzz'},
                bar: {NS: ['1', '2', '3']},
                baz: {L: [{BOOL: true}, {N: '4'}]}
            }}));

            const result = await mapper.delete({
                item: {
                    foo: 'buzz',
                    [DynamoDbTable]() {
                        return 'foo';
                    },
                    [DynamoDbSchema]() {
                        return {
                            foo: {
                                type: 'String',
                                attributeName: 'fizz',
                                keyType: 'HASH',
                            },
                            bar: {
                                type: 'Set',
                                memberType: 'Number'
                            },
                            baz: {
                                type: 'Tuple',
                                members: [{type: 'Boolean'}, {type: 'Number'}]
                            },
                        };
                    },
                },
                returnValues: "ALL_OLD"
            });

            expect(result).toEqual({
                foo: 'buzz',
                bar: new Set([1, 2, 3]),
                baz: [true, 4],
            })
        });
    });

    describe('#get', () => {
        const promiseFunc = jest.fn(() => Promise.resolve({Item: {}}));
        const mockDynamoDbClient = {
            getItem: jest.fn(() => ({promise: promiseFunc})),
        };

        beforeEach(() => {
            promiseFunc.mockClear();
            mockDynamoDbClient.getItem.mockClear();
        });

        const mapper = new DataMapper({
            client: mockDynamoDbClient as any,
        });

        it(
            'should use the table name specified in the supplied table definition',
            async () => {
                const tableName = 'foo';
                await mapper.get({
                    item: {
                        [DynamoDbTable]() {
                            return tableName;
                        },
                        [DynamoDbSchema]() {
                            return {};
                        },
                    },
                });

                expect(mockDynamoDbClient.getItem.mock.calls[0][0])
                    .toMatchObject({TableName: tableName});
            }
        );

        it(
            'should apply a table name prefix provided to the mapper constructor',
            async () => {
                const tableNamePrefix = 'INTEG_';
                const mapper = new DataMapper({
                    client: mockDynamoDbClient as any,
                    tableNamePrefix,
                });
                const tableName = 'foo';
                await mapper.get({
                    item: {
                        [DynamoDbTable]() {
                            return tableName;
                        },
                        [DynamoDbSchema]() {
                            return {};
                        },
                    },
                });

                expect(mockDynamoDbClient.getItem.mock.calls[0][0])
                    .toMatchObject({TableName: tableNamePrefix + tableName});
            }
        );

        it(
            'should marshall the supplied key according to the schema',
            async () => {
                await mapper.get({
                    item: {
                        fizz: 'buzz',
                        pop: new Date(60000),
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Date',
                                    keyType: 'RANGE'
                                },
                            };
                        },
                    },
                });

                expect(mockDynamoDbClient.getItem.mock.calls[0][0])
                    .toMatchObject({
                        Key: {
                            fizz: {S: 'buzz'},
                            pop: {N: '60'},
                        }
                    });
            }
        );

        it(
            'should ignore non-key fields when marshalling the key',
            async () => {
                await mapper.get({
                    item: {
                        fizz: 'buzz',
                        pop: new Date(60000),
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Date'
                                },
                            };
                        },
                    }
                });

                expect(mockDynamoDbClient.getItem.mock.calls[0][0])
                    .toMatchObject({
                        Key: {fizz: {S: 'buzz'}}
                    });
            }
        );

        it(
            'should apply attribute names when marshalling the key',
            async () => {
                await mapper.get({
                    item: {
                        fizz: 'buzz',
                        pop: new Date(60000),
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    attributeName: 'foo',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Date'
                                },
                            };
                        },
                    },
                });

                expect(mockDynamoDbClient.getItem.mock.calls[0][0])
                    .toMatchObject({
                        Key: {foo: {S: 'buzz'}}
                    });
            }
        );

        it(
            'should request a consistent read if the readConsistency is StronglyConsistent',
            async () => {
                await mapper.get({
                    item: {
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {};
                        },
                    },
                    readConsistency: ReadConsistency.StronglyConsistent
                });

                expect(mockDynamoDbClient.getItem.mock.calls[0][0])
                    .toMatchObject({ConsistentRead: true});
            }
        );

        it(
            'should apply the read consistency provided to the mapper constructor if not supplied to the operation',
            async () => {
                const mapper = new DataMapper({
                    client: mockDynamoDbClient as any,
                    readConsistency: ReadConsistency.StronglyConsistent,
                });
                await mapper.get({
                    item: {
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {};
                        },
                    },
                });

                expect(mockDynamoDbClient.getItem.mock.calls[0][0])
                    .toMatchObject({ConsistentRead: true});
            }
        );

        it('should serialize a provided projection expression', async () => {
            await mapper.get({
                item: {
                    [DynamoDbTable]() {
                        return 'foo';
                    },
                    [DynamoDbSchema]() {
                        return {
                            fizz: {
                                type: 'String',
                                attributeName: 'foo',
                                keyType: 'HASH',
                            },
                            pop: {
                                type: 'Date'
                            },
                        };
                    },
                },
                projection: ['fizz', 'pop'],
            });

            expect(mockDynamoDbClient.getItem.mock.calls[0][0])
                .toMatchObject({
                    ProjectionExpression: '#attr0, #attr1',
                    ExpressionAttributeNames: {
                        '#attr0': 'foo',
                        '#attr1': 'pop',
                    },
                });
        });

        it(
            'should convert an empty (item not found) response into a rejected promise whose rejection includes the request sent to DynamoDB',
            () => {
                promiseFunc.mockImplementation(() => Promise.resolve({}));

                return expect(mapper.get({
                    item: {
                        fizz: 'buzz',
                        pop: new Date(60000),
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    attributeName: 'foo',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Date'
                                },
                            };
                        },
                    },
                    readConsistency: ReadConsistency.StronglyConsistent,
                    projection: ['fizz', 'pop'],
                })).rejects.toMatchObject({
                    itemSought: {
                        TableName: 'foo',
                        Key: {foo: {S: 'buzz'}},
                        ConsistentRead: true,
                        ProjectionExpression: '#attr0, #attr1',
                        ExpressionAttributeNames: {
                            '#attr0': 'foo',
                            '#attr1': 'pop',
                        },
                    }
                });
            }
        );

        it('should unmarshall the response using the table schema', async () => {
            promiseFunc.mockImplementation(() => Promise.resolve({
                Item: {
                    foo: {S: 'buzz'},
                    pop: {N: '60'},
                }
            }));

            const result = await mapper.get({
                item: {
                    fizz: 'buzz',
                    [DynamoDbTable]() {
                        return 'foo';
                    },
                    [DynamoDbSchema]() {
                        return {
                            fizz: {
                                type: 'String',
                                attributeName: 'foo',
                                keyType: 'HASH',
                            },
                            pop: {
                                type: 'Date'
                            },
                        };
                    },
                },
            });

            expect(result).toEqual({
                fizz: 'buzz',
                pop: new Date(60000),
            });
        });
    });

    describe('#put', () => {
        const promiseFunc = jest.fn(() => Promise.resolve({Item: {}}));
        const mockDynamoDbClient = {
            putItem: jest.fn(() => ({promise: promiseFunc})),
        };

        beforeEach(() => {
            promiseFunc.mockClear();
            mockDynamoDbClient.putItem.mockClear();
        });

        const mapper = new DataMapper({
            client: mockDynamoDbClient as any,
        });

        it(
            'should use the table name specified in the supplied table definition',
            async () => {
                const tableName = 'foo';
                await mapper.put({
                    item: {
                        [DynamoDbTable]() {
                            return tableName;
                        },
                        [DynamoDbSchema]() {
                            return {};
                        },
                    },
                });

                expect(mockDynamoDbClient.putItem.mock.calls[0][0])
                    .toMatchObject({TableName: tableName});
            }
        );

        it(
            'should apply a table name prefix provided to the mapper constructor',
            async () => {
                const tableNamePrefix = 'INTEG_';
                const mapper = new DataMapper({
                    client: mockDynamoDbClient as any,
                    tableNamePrefix,
                });
                const tableName = 'foo';
                await mapper.put({
                    item: {
                        [DynamoDbTable]() {
                            return tableName;
                        },
                        [DynamoDbSchema]() {
                            return {};
                        },
                    },
                });

                expect(mockDynamoDbClient.putItem.mock.calls[0][0])
                    .toMatchObject({TableName: tableNamePrefix + tableName});
            }
        );

        it(
            'should marshall the supplied item according to the schema',
            async () => {
                await mapper.put({
                    item: {
                        fizz: 'buzz',
                        pop: new Date(60000),
                        snap: false,
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {type: 'String'},
                                pop: {type: 'Date'},
                                snap: {
                                    type: 'Boolean',
                                    attributeName: 'crackle',
                                }
                            };
                        },
                    },
                });

                expect(mockDynamoDbClient.putItem.mock.calls[0][0])
                    .toMatchObject({
                        Item: {
                            fizz: {S: 'buzz'},
                            pop: {N: '60'},
                            crackle: {BOOL: false},
                        }
                    });
            }
        );

        it(
            'should include a condition expression and increment the version number when the schema contains a version attribute',
            async () => {
                await mapper.put({
                    item: {
                        fizz: 'buzz',
                        pop: 21,
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    attributeName: 'foo',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Number',
                                    versionAttribute: true,
                                },
                            };
                        },
                    },
                });

                expect(mockDynamoDbClient.putItem.mock.calls[0][0])
                    .toMatchObject({
                        Item: {
                            foo: {S: 'buzz'},
                            pop: {N: '22'},
                        },
                        ConditionExpression: '#attr0 = :val1',
                        ExpressionAttributeNames: {'#attr0': 'pop'},
                        ExpressionAttributeValues: {':val1': {N: '21'}},
                    });
            }
        );

        it(
            'should include a condition expression requiring that no versioned item be present when the schema contains a version attribute but the value is undefined',
            async () => {
                await mapper.put({
                    item: {
                        fizz: 'buzz',
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    attributeName: 'foo',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Number',
                                    versionAttribute: true,
                                },
                            };
                        },
                    },
                });

                expect(mockDynamoDbClient.putItem.mock.calls[0][0])
                    .toMatchObject({
                        Item: {
                            foo: {S: 'buzz'},
                            pop: {N: '0'},
                        },
                        ConditionExpression: 'attribute_not_exists(#attr0)',
                        ExpressionAttributeNames: {'#attr0': 'pop'},
                        ExpressionAttributeValues: {},
                    });
            }
        );

        it(
            'should not include a condition expression when the skipVersionCheck input parameter is true',
            async () => {
                await mapper.put({
                    item: {
                        fizz: 'buzz',
                        pop: 21,
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    attributeName: 'foo',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Number',
                                    versionAttribute: true,
                                },
                            };
                        },
                    },
                    skipVersionCheck: true,
                });

                expect(mockDynamoDbClient.putItem.mock.calls[0][0])
                    .not.toHaveProperty('ConditionExpression');
            }
        );

        it(
            `should not include a condition expression when the mapper's default skipVersionCheck input parameter is true`,
            async () => {
                const mapper = new DataMapper({
                    client: mockDynamoDbClient as any,
                    skipVersionCheck: true
                });
                await mapper.put({
                    item: {
                        fizz: 'buzz',
                        pop: 21,
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    attributeName: 'foo',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Number',
                                    versionAttribute: true,
                                },
                            };
                        },
                    },
                });

                expect(mockDynamoDbClient.putItem.mock.calls[0][0])
                    .not.toHaveProperty('ConditionExpression');
            }
        );

        it(
            'should combine the version condition with any other condition expression',
            async () => {
                await mapper.put({
                    item: {
                        fizz: 'buzz',
                        pop: 21,
                        [DynamoDbTable]() {
                            return 'foo';
                        },
                        [DynamoDbSchema]() {
                            return {
                                fizz: {
                                    type: 'String',
                                    attributeName: 'foo',
                                    keyType: 'HASH',
                                },
                                pop: {
                                    type: 'Number',
                                    versionAttribute: true,
                                },
                                quux: {type: 'Date'},
                            };
                        },
                    },
                    condition: {
                        type: 'LessThan',
                        subject: 'quux',
                        object: 600000
                    }
                });

                expect(mockDynamoDbClient.putItem.mock.calls[0][0])
                    .toMatchObject({
                        ConditionExpression: '(#attr0 < :val1) AND (#attr2 = :val3)',
                        ExpressionAttributeNames: {
                            '#attr0': 'quux',
                            '#attr2': 'pop',
                        },
                        ExpressionAttributeValues: {
                            ':val1': {N: '600000'},
                            ':val3': {N: '21'}
                        },
                    });
            }
        );

        it('should unmarshall any returned attributes', async () => {
            promiseFunc.mockImplementation(() => Promise.resolve({Attributes: {
                fizz: {S: 'buzz'},
                bar: {NS: ['1', '2', '3']},
                baz: {L: [{BOOL: true}, {N: '4'}]}
            }}));

            const result = await mapper.put({
                item: {
                    foo: 'buzz',
                    [DynamoDbTable]() {
                        return 'foo';
                    },
                    [DynamoDbSchema]() {
                        return {
                            foo: {
                                type: 'String',
                                attributeName: 'fizz',
                                keyType: 'HASH',
                            },
                            bar: {
                                type: 'Set',
                                memberType: 'Number'
                            },
                            baz: {
                                type: 'Tuple',
                                members: [{type: 'Boolean'}, {type: 'Number'}]
                            },
                        };
                    },
                },
                returnValues: "ALL_OLD"
            });

            expect(result).toEqual({
                foo: 'buzz',
                bar: new Set([1, 2, 3]),
                baz: [true, 4],
            })
        });
    });

    describe('#query', () => {
        const promiseFunc = jest.fn();
        const mockDynamoDbClient = {query: jest.fn()};

        beforeEach(() => {
            promiseFunc.mockClear();
            promiseFunc.mockImplementation(() => Promise.resolve({Attributes: {}}));
            mockDynamoDbClient.query.mockClear();
            mockDynamoDbClient.query.mockImplementation(() => ({promise: promiseFunc}));
        });

        const mapper = new DataMapper({
            client: mockDynamoDbClient as any,
        });

        class QueryableItem {
            snap: string;
            fizz?: Array<string>;

            [DynamoDbTable]() { return 'foo'; }
            [DynamoDbSchema]() {
                return {
                    snap: {
                        type: 'String',
                        keyType: 'HASH',
                    },
                    fizz: {
                        type: 'List',
                        memberType: {type: 'String'},
                        attributeName: 'fizzes',
                    },
                };
            }
        }

        it(
            'should paginate over results and return a promise for each item',
            async () => {
                promiseFunc.mockImplementationOnce(() => Promise.resolve({
                    Items: [
                        {
                            fizz: {S: 'snap'},
                            bar: {NS: ['1', '2', '3']},
                            baz: {L: [{BOOL: true}, {N: '4'}]}
                        },
                    ],
                    LastEvaluatedKey: {fizz: {S: 'snap'}},
                }));
                promiseFunc.mockImplementationOnce(() => Promise.resolve({
                    Items: [
                        {
                            fizz: {S: 'crackle'},
                            bar: {NS: ['5', '6', '7']},
                            baz: {L: [{BOOL: false}, {N: '8'}]}
                        },
                    ],
                    LastEvaluatedKey: {fizz: {S: 'crackle'}},
                }));
                promiseFunc.mockImplementationOnce(() => Promise.resolve({
                    Items: [
                        {
                            fizz: {S: 'pop'},
                            bar: {NS: ['9', '12', '30']},
                            baz: {L: [{BOOL: true}, {N: '24'}]}
                        },
                    ],
                    LastEvaluatedKey: {fizz: {S: 'pop'}},
                }));
                promiseFunc.mockImplementationOnce(() => Promise.resolve({}));

                const results = mapper.query({
                    keyCondition: {
                        foo: 'buzz'
                    },
                    valueConstructor: class {
                        [DynamoDbTable]() { return 'foo'; }
                        [DynamoDbSchema]() {
                            return {
                                foo: {
                                    type: 'String',
                                    attributeName: 'fizz',
                                    keyType: 'HASH',
                                },
                                bar: {
                                    type: 'Set',
                                    memberType: 'Number'
                                },
                                baz: {
                                    type: 'Tuple',
                                    members: [{type: 'Boolean'}, {type: 'Number'}]
                                },
                            };
                        }
                    }
                });

                const result: any[] = [];
                for await (const res of results) {
                    result.push(res);
                }

                expect(result).toEqual([
                    {
                        foo: 'snap',
                        bar: new Set([1, 2, 3]),
                        baz: [true, 4],
                    },
                    {
                        foo: 'crackle',
                        bar: new Set([5, 6, 7]),
                        baz: [false, 8],
                    },
                    {
                        foo: 'pop',
                        bar: new Set([9, 12, 30]),
                        baz: [true, 24],
                    },
                ]);
            }
        );

        it(
            'should request a consistent read if the readConsistency is StronglyConsistent',
            async () => {
                const results =  mapper.query({
                    keyCondition: {foo: 'bar'},
                    valueConstructor: QueryableItem,
                    readConsistency: ReadConsistency.StronglyConsistent
                });

                results.next();

                expect(mockDynamoDbClient.query.mock.calls[0][0])
                    .toMatchObject({ConsistentRead: true});
            }
        );

        it('should allow a condition expression as the keyCondition', () => {
            const results =  mapper.query({
                keyCondition: {
                    type: 'And',
                    conditions: [
                        {
                            type: 'Equals',
                            subject: 'snap',
                            object: 'crackle',
                        },
                        new FunctionExpression(
                            'begins_with',
                            new AttributePath('fizz'),
                            'buz'
                        )
                    ]
                },
                valueConstructor: class {
                    [DynamoDbTable]() { return 'foo'; }
                    [DynamoDbSchema]() {
                        return {
                            snap: {
                                type: 'String',
                                keyType: 'HASH',
                            },
                            fizz: {
                                type: 'String',
                                keyType: 'RANGE',
                            },
                        };
                    }
                },
            });

            results.next();

            expect(mockDynamoDbClient.query.mock.calls[0][0])
                .toMatchObject({
                    KeyConditionExpression: '(#attr0 = :val1) AND (begins_with(#attr2, :val3))',
                    ExpressionAttributeNames: {
                        '#attr0': 'snap',
                        '#attr2': 'fizz',
                    },
                    ExpressionAttributeValues: {
                        ':val1': {S: 'crackle'},
                        ':val3': {S: 'buz'}
                    },
                });
        });

        it(
            'should allow a condition expression predicate in the keyCondition',
            () => {
                const results =  mapper.query({
                    keyCondition: {
                        snap: 'crackle',
                        pop: between(10, 20),
                    },
                    valueConstructor: QueryableItem,
                });

                results.next();

                expect(mockDynamoDbClient.query.mock.calls[0][0])
                    .toMatchObject({
                        KeyConditionExpression: '(#attr0 = :val1) AND (#attr2 BETWEEN :val3 AND :val4)',
                        ExpressionAttributeNames: {
                            '#attr0': 'snap',
                            '#attr2': 'pop',
                        },
                        ExpressionAttributeValues: {
                            ':val1': {S: 'crackle'},
                            ':val3': {N: '10'},
                            ':val4': {N: '20'}
                        },
                    });
            }
        );

        it('should allow a filter expression', () => {
            const results =  mapper.query({
                keyCondition: {
                    snap: 'crackle',
                },
                valueConstructor: QueryableItem,
                filter: {
                    subject: 'fizz[1]',
                    ...inList('buzz', 'pop'),
                },
            });

            results.next();

            expect(mockDynamoDbClient.query.mock.calls[0][0])
                .toMatchObject({
                    FilterExpression: '#attr2[1] IN (:val3, :val4)',
                    ExpressionAttributeNames: {
                        '#attr0': 'snap',
                        '#attr2': 'fizzes',
                    },
                    ExpressionAttributeValues: {
                        ':val1': {S: 'crackle'},
                        ':val3': {S: 'buzz'},
                        ':val4': {S: 'pop'},
                    },
                });
        });

        it('should allow a projection expression', () => {
            const results =  mapper.query({
                keyCondition: {
                    snap: 'crackle',
                },
                valueConstructor: QueryableItem,
                projection: ['snap', 'fizz[1]'],
            });

            results.next();

            expect(mockDynamoDbClient.query.mock.calls[0][0])
                .toMatchObject({
                    ProjectionExpression: '#attr0, #attr2[1]',
                    ExpressionAttributeNames: {
                        '#attr0': 'snap',
                        '#attr2': 'fizzes',
                    },
                    ExpressionAttributeValues: {
                        ':val1': {S: 'crackle'},
                    },
                });
        });

        it('should allow a start key', () => {
            const results =  mapper.query({
                keyCondition: {
                    snap: 'crackle',
                },
                valueConstructor: class {
                    [DynamoDbTable]() { return 'foo'; }
                    [DynamoDbSchema]() {
                        return {
                            snap: {
                                type: 'String',
                                keyType: 'HASH',
                            },
                            fizz: {
                                type: 'Number',
                                keyType: 'RANGE'
                            },
                        };
                    }
                },
                startKey: {fizz: 100},
            });

            results.next();

            expect(mockDynamoDbClient.query.mock.calls[0][0])
                .toMatchObject({
                    ExclusiveStartKey: {
                        fizz: {N: '100'},
                    }
                });
        });
    });

    describe('#scan', () => {
        const promiseFunc = jest.fn();
        const mockDynamoDbClient = {scan: jest.fn()};

        beforeEach(() => {
            promiseFunc.mockClear();
            promiseFunc.mockImplementation(() => Promise.resolve({Attributes: {}}));
            mockDynamoDbClient.scan.mockClear();
            mockDynamoDbClient.scan.mockImplementation(() => ({promise: promiseFunc}));
        });

        const mapper = new DataMapper({
            client: mockDynamoDbClient as any,
        });

        class ScannableItem {
            snap: string;
            fizz?: Array<string>;

            [DynamoDbTable]() { return 'foo'; }
            [DynamoDbSchema]() {
                return {
                    snap: {
                        type: 'String',
                        keyType: 'HASH',
                    },
                    fizz: {
                        type: 'List',
                        memberType: {type: 'String'},
                        attributeName: 'fizzes',
                    },
                };
            }
        }

        it(
            'should paginate over results and return a promise for each item',
            async () => {
                promiseFunc.mockImplementationOnce(() => Promise.resolve({
                    Items: [
                        {
                            fizz: {S: 'snap'},
                            bar: {NS: ['1', '2', '3']},
                            baz: {L: [{BOOL: true}, {N: '4'}]}
                        },
                    ],
                    LastEvaluatedKey: {fizz: {S: 'snap'}},
                }));
                promiseFunc.mockImplementationOnce(() => Promise.resolve({
                    Items: [
                        {
                            fizz: {S: 'crackle'},
                            bar: {NS: ['5', '6', '7']},
                            baz: {L: [{BOOL: false}, {N: '8'}]}
                        },
                    ],
                    LastEvaluatedKey: {fizz: {S: 'crackle'}},
                }));
                promiseFunc.mockImplementationOnce(() => Promise.resolve({
                    Items: [
                        {
                            fizz: {S: 'pop'},
                            bar: {NS: ['9', '12', '30']},
                            baz: {L: [{BOOL: true}, {N: '24'}]}
                        },
                    ],
                    LastEvaluatedKey: {fizz: {S: 'pop'}},
                }));
                promiseFunc.mockImplementationOnce(() => Promise.resolve({}));

                const results = mapper.scan({
                    valueConstructor: class {
                        [DynamoDbTable]() { return 'foo'; }
                        [DynamoDbSchema]() {
                            return {
                                foo: {
                                    type: 'String',
                                    attributeName: 'fizz',
                                    keyType: 'HASH',
                                },
                                bar: {
                                    type: 'Set',
                                    memberType: 'Number'
                                },
                                baz: {
                                    type: 'Tuple',
                                    members: [{type: 'Boolean'}, {type: 'Number'}]
                                },
                            };
                        }
                    }
                });

                const result: any[] = [];
                for await (const res of results) {
                    result.push(res);
                }

                expect(result).toEqual([
                    {
                        foo: 'snap',
                        bar: new Set([1, 2, 3]),
                        baz: [true, 4],
                    },
                    {
                        foo: 'crackle',
                        bar: new Set([5, 6, 7]),
                        baz: [false, 8],
                    },
                    {
                        foo: 'pop',
                        bar: new Set([9, 12, 30]),
                        baz: [true, 24],
                    },
                ]);
            }
        );

        it(
            'should request a consistent read if the readConsistency is StronglyConsistent',
            async () => {
                const results =  mapper.scan({
                    valueConstructor: ScannableItem,
                    readConsistency: ReadConsistency.StronglyConsistent
                });

                results.next();

                expect(mockDynamoDbClient.scan.mock.calls[0][0])
                    .toMatchObject({ConsistentRead: true});
            }
        );

        it('should allow a filter expression', () => {
            const results =  mapper.scan({
                valueConstructor: ScannableItem,
                filter: {
                    type: 'Not',
                    condition: {
                        subject: 'fizz[1]',
                        ...equals('buzz'),
                    }
                },
            });

            results.next();

            expect(mockDynamoDbClient.scan.mock.calls[0][0])
                .toMatchObject({
                    FilterExpression: 'NOT (#attr0[1] = :val1)',
                    ExpressionAttributeNames: {
                        '#attr0': 'fizzes',
                    },
                    ExpressionAttributeValues: {
                        ':val1': {S: 'buzz'},
                    },
                });
        });

        it('should allow a projection expression', () => {
            const results =  mapper.scan({
                valueConstructor: ScannableItem,
                projection: ['snap', 'fizz[1]'],
            });

            results.next();

            expect(mockDynamoDbClient.scan.mock.calls[0][0])
                .toMatchObject({
                    ProjectionExpression: '#attr0, #attr1[1]',
                    ExpressionAttributeNames: {
                        '#attr0': 'snap',
                        '#attr1': 'fizzes',
                    },
                });
        });

        it('should allow a start key', () => {
            const results =  mapper.scan({
                valueConstructor: class {
                    [DynamoDbTable]() { return 'foo'; }
                    [DynamoDbSchema]() {
                        return {
                            snap: {
                                type: 'String',
                                keyType: 'HASH',
                            },
                            fizz: {
                                type: 'Number',
                                keyType: 'RANGE'
                            },
                        };
                    }
                },
                startKey: {fizz: 100},
            });

            results.next();

            expect(mockDynamoDbClient.scan.mock.calls[0][0])
                .toMatchObject({
                    ExclusiveStartKey: {
                        fizz: {N: '100'},
                    }
                });
        });
    });

    describe('#update', () => {
        const tableName = 'foo';

        class EmptyItem {
            [DynamoDbTable]() {
                return tableName;
            }

            [DynamoDbSchema]() {
                return {};
            }
        }

        class ComplexItem extends EmptyItem {
            foo: string;
            bar?: [number, BinaryValue];
            quux?: {
                snap: string;
                crackle: Date;
                pop: {[key: string]: any};
            };

            [DynamoDbSchema]() {
                return {
                    foo: {
                        type: 'String',
                        keyType: 'HASH',
                        attributeName: 'fizz'
                    },
                    bar: {
                        type: 'Tuple',
                        members: [
                            {type: 'Number'},
                            {type: 'Binary'},
                        ],
                        attributeName: 'buzz',
                    },
                    quux: {
                        type: 'Document',
                        members: {
                            snap: { type: 'String' },
                            crackle: { type: 'Date' },
                            pop: { type: 'Hash' },
                        } as Schema,
                    },
                };
            }
        }

        const promiseFunc = jest.fn();
        const mockDynamoDbClient = {
            updateItem: jest.fn(),
        };

        beforeEach(() => {
            promiseFunc.mockClear();
            promiseFunc.mockImplementation(() => Promise.resolve({Attributes: {}}));
            mockDynamoDbClient.updateItem.mockClear();
            mockDynamoDbClient.updateItem.mockImplementation(() => ({promise: promiseFunc}));
        });

        const mapper = new DataMapper({
            client: mockDynamoDbClient as any,
        });

        it(
            'should use the table name specified in the supplied table definition',
            async () => {
                const tableName = 'foo';
                await mapper.update({item: new EmptyItem()});

                expect(mockDynamoDbClient.updateItem.mock.calls[0][0])
                    .toMatchObject({TableName: tableName});
            }
        );

        it(
            'should apply a table name prefix provided to the mapper constructor',
            async () => {
                const tableNamePrefix = 'INTEG_';
                const mapper = new DataMapper({
                    client: mockDynamoDbClient as any,
                    tableNamePrefix,
                });
                const tableName = 'foo';
                await mapper.update({item: new EmptyItem()});

                expect(mockDynamoDbClient.updateItem.mock.calls[0][0])
                    .toMatchObject({TableName: tableNamePrefix + tableName});
            }
        );

        it('should marshall updates into an UpdateItemInput', async () => {
            const item = new ComplexItem();
            item.foo = 'key';
            item.bar = [1, Uint8Array.from([0xde, 0xad, 0xbe, 0xef])];

            await mapper.update({item});

            expect(mockDynamoDbClient.updateItem.mock.calls[0][0])
                .toMatchObject({
                    TableName: tableName,
                    Key: {
                        fizz: {S: 'key'}
                    },
                    ExpressionAttributeNames: {
                        '#attr0': 'buzz',
                        '#attr2': 'quux',
                    },
                    ExpressionAttributeValues: {
                        ':val1': {
                            L: [
                                {N: '1'},
                                {B: Uint8Array.from([0xde, 0xad, 0xbe, 0xef])}
                            ],
                        }
                    },
                    UpdateExpression: 'SET #attr0 = :val1 REMOVE #attr2',
                });
        });

        it(
            'should not remove missing keys when onMissing is "SKIP"',
            async () => {
                const item = new ComplexItem();
                item.foo = 'key';
                item.bar = [1, Uint8Array.from([0xde, 0xad, 0xbe, 0xef])];
                await mapper.update({
                    item,
                    onMissing: OnMissingStrategy.Skip
                });

                expect(mockDynamoDbClient.updateItem.mock.calls[0][0])
                    .toMatchObject({
                        TableName: tableName,
                        Key: {
                            fizz: {S: 'key'}
                        },
                        ExpressionAttributeNames: {
                            '#attr0': 'buzz',
                        },
                        ExpressionAttributeValues: {
                            ':val1': {
                                L: [
                                    {N: '1'},
                                    {B: Uint8Array.from([0xde, 0xad, 0xbe, 0xef])}
                                ],
                            }
                        },
                        UpdateExpression: 'SET #attr0 = :val1',
                    });
            }
        );

        it('should unmarshall any returned attributes', async () => {
            promiseFunc.mockImplementation(() => Promise.resolve({Attributes: {
                fizz: {S: 'buzz'},
                bar: {NS: ['1', '2', '3']},
                baz: {L: [{BOOL: true}, {N: '4'}]}
            }}));

            const result = await mapper.update({
                item: {
                    foo: 'buzz',
                    [DynamoDbTable]() { return 'foo'; },
                    [DynamoDbSchema]() {
                        return {
                            foo: {
                                type: 'String',
                                attributeName: 'fizz',
                                keyType: 'HASH',
                            },
                            bar: {
                                type: 'Set',
                                memberType: 'Number'
                            },
                            baz: {
                                type: 'Tuple',
                                members: [{type: 'Boolean'}, {type: 'Number'}]
                            },
                        };
                    },
                }
            });

            expect(result).toEqual({
                foo: 'buzz',
                bar: new Set([1, 2, 3]),
                baz: [true, 4],
            })
        });

        it('should throw an error if no attributes were returned', async () => {
            promiseFunc.mockImplementation(() => Promise.resolve({}));

            return expect(mapper.update({
                item: {
                    foo: 'buzz',
                    [DynamoDbTable]() { return 'foo'; },
                    [DynamoDbSchema]() {
                        return {
                            foo: {
                                type: 'String',
                                attributeName: 'fizz',
                                keyType: 'HASH',
                            },
                            bar: {
                                type: 'Set',
                                memberType: 'Number'
                            },
                            baz: {
                                type: 'Tuple',
                                members: [{type: 'Boolean'}, {type: 'Number'}]
                            },
                        };
                    },
                },
            })).rejects.toMatchObject({
                message: 'Update operation completed successfully, but the updated value was not returned'
            });
        });

        describe('version attributes', () => {
            class VersionedItem {
                foo: string;
                bar?: [number, Uint8Array];
                baz?: number;

                [DynamoDbTable]() {
                    return 'table';
                }

                [DynamoDbSchema]() {
                    return {
                        foo: {
                            type: 'String',
                            keyType: 'HASH',
                            attributeName: 'fizz'
                        },
                        bar: {
                            type: 'Tuple',
                            members: [
                                {type: 'Number'},
                                {type: 'Binary'},
                            ],
                            attributeName: 'buzz',
                        },
                        baz: {
                            type: 'Number',
                            versionAttribute: true,
                        },
                    };
                }
            }

            it(
                'should inject a conditional expression requiring the absence of the versioning property and set its value to 0 when an object without a value for it is marshalled',
                async () => {
                    const item = new VersionedItem();
                    item.foo = 'key';
                    item.bar = [1, Uint8Array.from([0xde, 0xad, 0xbe, 0xef])];

                    await mapper.update({item});

                    expect(mockDynamoDbClient.updateItem.mock.calls[0][0])
                        .toMatchObject({
                            TableName: 'table',
                            Key: {
                                fizz: {S: 'key'}
                            },
                            ConditionExpression: 'attribute_not_exists(#attr0)',
                            ExpressionAttributeNames: {
                                '#attr0': 'baz',
                                '#attr1': 'buzz',
                            },
                            ExpressionAttributeValues: {
                                ':val2': {
                                    L: [
                                        {N: '1'},
                                        {B: Uint8Array.from([0xde, 0xad, 0xbe, 0xef])}
                                    ],
                                },
                                ':val3': {N: '0'},
                            },
                            UpdateExpression: 'SET #attr1 = :val2, #attr0 = :val3',
                        });
                }
            );

            it(
                'should inject a conditional expression requiring the known value of the versioning property and set its value to the previous value + 1 when an object with a value for it is marshalled',
                async () => {
                    const item = new VersionedItem();
                    item.foo = 'key';
                    item.bar = [1, Uint8Array.from([0xde, 0xad, 0xbe, 0xef])];
                    item.baz = 10;

                    await mapper.update({item});

                    expect(mockDynamoDbClient.updateItem.mock.calls[0][0])
                        .toMatchObject({
                            TableName: 'table',
                            Key: {
                                fizz: {S: 'key'}
                            },
                            ConditionExpression: '#attr0 = :val1',
                            ExpressionAttributeNames: {
                                '#attr0': 'baz',
                                '#attr2': 'buzz',
                            },
                            ExpressionAttributeValues: {
                                ':val1': {N: '10'},
                                ':val3': {
                                    L: [
                                        {N: '1'},
                                        {B: Uint8Array.from([0xde, 0xad, 0xbe, 0xef])}
                                    ],
                                },
                                ':val4': {N: '1'},
                            },
                            UpdateExpression: 'SET #attr2 = :val3, #attr0 = #attr0 + :val4',
                        });
                }
            );

            it(
                'should not include a condition expression when the skipVersionCheck input parameter is true',
                async () => {
                    const item = new VersionedItem();
                    item.foo = 'key';
                    item.bar = [1, Uint8Array.from([0xde, 0xad, 0xbe, 0xef])];
                    item.baz = 10;

                    await mapper.update({
                        item,
                        skipVersionCheck: true,
                    });

                    expect(mockDynamoDbClient.updateItem.mock.calls[0][0])
                        .not.toHaveProperty('ConditionExpression');
                }
            );

            it(
                `should not include a condition expression when the mapper's default skipVersionCheck input parameter is true`,
                async () => {
                    const mapper = new DataMapper({
                        client: mockDynamoDbClient as any,
                        skipVersionCheck: true
                    });

                    const item = new VersionedItem();
                    item.foo = 'key';
                    item.bar = [1, Uint8Array.from([0xde, 0xad, 0xbe, 0xef])];
                    item.baz = 10;

                    await mapper.update({item});

                    expect(mockDynamoDbClient.updateItem.mock.calls[0][0])
                        .not.toHaveProperty('ConditionExpression');
                }
            );

            it(
                'should combine the version condition with any other condition expression',
                async () => {
                    const item = new VersionedItem();
                    item.foo = 'key';
                    item.bar = [1, Uint8Array.from([0xde, 0xad, 0xbe, 0xef])];
                    item.baz = 10;

                    await mapper.update({
                        item,
                        condition: {
                            type: 'LessThan',
                            subject: 'bar[0]',
                            object: 600000
                        }
                    });

                    expect(mockDynamoDbClient.updateItem.mock.calls[0][0])
                        .toMatchObject({
                            ConditionExpression: '(#attr0[0] < :val1) AND (#attr2 = :val3)',
                            ExpressionAttributeNames: {
                                '#attr0': 'buzz',
                                '#attr2': 'baz',
                            },
                            ExpressionAttributeValues: {
                                ':val1': {N: '600000'},
                                ':val3': {N: '10'},
                                ':val4': {
                                    L: [
                                        {N: '1'},
                                        {B: Uint8Array.from([0xde, 0xad, 0xbe, 0xef])},
                                    ],
                                },
                            },
                        });
                }
            );
        });
    });
});