import { faker } from '@faker-js/faker';
import {
  DataDecoded,
  DataDecodedParameter,
} from '../../../../domain/data-decoder/entities/data-decoded.entity';
import { DataDecodedParamHelper } from './data-decoded-param.helper';

describe('DataDecoded param helper (Unit)', () => {
  const helper = new DataDecodedParamHelper();

  describe('getFromParam function tests', () => {
    it('should return the fallback value if null parameters in DataDecoded', () => {
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: null,
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if empty parameters in DataDecoded', () => {
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [],
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if non-string parameters in DataDecoded', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 0,
      };
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam],
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "from" param for a transfer method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = <DataDecoded>{
        method: 'transfer',
        parameters: [firstParam],
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "from" param for a transferFrom method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam],
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('value');
    });

    it('should get the DataDecoded "from" param for a safeTransferFrom method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = <DataDecoded>{
        method: 'safeTransferFrom',
        parameters: [firstParam],
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('value');
    });

    it('should return the fallback value if method is not "transferFrom"', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = <DataDecoded>{
        method: faker.random.word(),
        parameters: [firstParam],
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });
  });

  describe('getToParam function tests', () => {
    it('should return the fallback value if null parameters in DataDecoded', () => {
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: null,
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if empty parameters in DataDecoded', () => {
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [],
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if non-string parameters in DataDecoded', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 0,
      };
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam],
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "to" param for a transfer method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'secondValue',
      };

      const dataDecoded = <DataDecoded>{
        method: 'transfer',
        parameters: [firstParam, secondParam],
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('firstValue');
    });

    it('should get the DataDecoded fallback for a non-string param', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: faker.datatype.number(),
      };
      const dataDecoded = <DataDecoded>{
        method: 'transfer',
        parameters: [firstParam, [firstParam]],
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "to" param for a transferFrom method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'secondValue',
      };

      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam, secondParam],
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('secondValue');
    });

    it('should get the DataDecoded "to" param for a safeTransferFrom method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'secondValue',
      };
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam, secondParam],
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('secondValue');
    });

    it('should return the fallback value if method is not "transferFrom"', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = <DataDecoded>{
        method: faker.random.word(),
        parameters: [firstParam],
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });
  });

  describe('getValueParam function tests', () => {
    it('should return the fallback value if null parameters in DataDecoded', () => {
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: null,
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if empty parameters in DataDecoded', () => {
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [],
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if non-string parameters in DataDecoded', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: faker.datatype.number(),
      };
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam],
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "value" param for a transfer method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'secondValue',
      };

      const dataDecoded = <DataDecoded>{
        method: 'transfer',
        parameters: [firstParam, secondParam],
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('secondValue');
    });

    it('should get the DataDecoded fallback for a non-string param', () => {
      const firstParam = {
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = {
        name: faker.random.word(),
        type: faker.random.word(),
        value: faker.datatype.number(),
      };

      const dataDecoded = <DataDecoded>{
        method: 'transfer',
        parameters: [firstParam, secondParam],
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "value" param for a transferFrom method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'secondValue',
      };
      const thirdParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'thirdValue',
      };
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam, secondParam, thirdParam],
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('thirdValue');
    });

    it('should get the DataDecoded "value" param for a safeTransferFrom method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'secondValue',
      };
      const thirdParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'thirdValue',
      };
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam, secondParam, thirdParam],
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('thirdValue');
    });

    it('should return the fallback value if method is not "transferFrom"', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = <DataDecoded>{
        method: faker.random.word(),
        parameters: [firstParam],
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });
  });

  describe('hasNestedDelegate function tests', () => {
    it('should return false if the nested data decoded only contains a CALL operation', () => {
      const dataDecoded = <DataDecoded>{
        method: faker.random.word(),
        parameters: [
          {
            name: faker.random.word(),
            type: faker.random.word(),
            value: faker.datatype.hexadecimal(32),
            valueDecoded: [
              {
                operation: 0,
                data: faker.datatype.hexadecimal(32),
                dataDecoded: {
                  method: faker.random.word(),
                  parameters: [
                    {
                      name: faker.random.word(),
                      type: faker.random.word(),
                      value: faker.finance.ethereumAddress(),
                    },
                    {
                      name: faker.random.word(),
                      type: faker.random.word(),
                      value: faker.random.numeric(),
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      expect(helper.hasNestedDelegate(dataDecoded)).toBe(false);
    });

    it('should return false if the nested data decoded only contains several CALL operations', () => {
      const dataDecoded = <DataDecoded>{
        method: faker.random.word(),
        parameters: [
          {
            name: faker.random.word(),
            type: faker.random.word(),
            value: faker.datatype.hexadecimal(32),
            valueDecoded: [
              {
                operation: 0,
                data: faker.datatype.hexadecimal(32),
                dataDecoded: {
                  method: faker.random.word(),
                  parameters: [
                    {
                      name: faker.random.word(),
                      type: faker.random.word(),
                      value: faker.finance.ethereumAddress(),
                    },
                    {
                      name: faker.random.word(),
                      type: faker.random.word(),
                      value: faker.random.numeric(),
                    },
                  ],
                },
              },
              {
                operation: 0,
                data: faker.datatype.hexadecimal(32),
                dataDecoded: {
                  method: faker.random.word(),
                  parameters: [
                    {
                      name: faker.random.word(),
                      type: faker.random.word(),
                      value: faker.finance.ethereumAddress(),
                    },
                    {
                      name: faker.random.word(),
                      type: faker.random.word(),
                      value: faker.random.numeric(),
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      expect(helper.hasNestedDelegate(dataDecoded)).toBe(false);
    });

    it('should return false if the nested data decoded does not have parameters', () => {
      const dataDecoded = <DataDecoded>{
        method: faker.random.word(),
      };

      expect(helper.hasNestedDelegate(dataDecoded)).toBe(false);
    });

    it('should return true if there is one nested DELEGATE operation', () => {
      const dataDecoded = <DataDecoded>{
        method: faker.random.word(),
        parameters: [
          {
            name: faker.random.word(),
            type: faker.random.word(),
            value: faker.datatype.hexadecimal(32),
            valueDecoded: [
              {
                operation: 1,
                data: faker.datatype.hexadecimal(32),
                dataDecoded: {
                  method: faker.random.word(),
                  parameters: [
                    {
                      name: faker.random.word(),
                      type: faker.random.word(),
                      value: faker.finance.ethereumAddress(),
                    },
                    {
                      name: faker.random.word(),
                      type: faker.random.word(),
                      value: faker.random.numeric(),
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      expect(helper.hasNestedDelegate(dataDecoded)).toBe(true);
    });

    it('should return true if there is just one nested DELEGATE operation', () => {
      const dataDecoded = <DataDecoded>{
        method: faker.random.word(),
        parameters: [
          {
            name: faker.random.word(),
            type: faker.random.word(),
            value: faker.datatype.hexadecimal(32),
            valueDecoded: [
              {
                operation: 1,
                data: faker.datatype.hexadecimal(32),
                dataDecoded: {
                  method: faker.random.word(),
                  parameters: [
                    {
                      name: faker.random.word(),
                      type: faker.random.word(),
                      value: faker.finance.ethereumAddress(),
                    },
                    {
                      name: faker.random.word(),
                      type: faker.random.word(),
                      value: faker.random.numeric(),
                    },
                  ],
                },
              },
              {
                operation: 0,
                data: faker.datatype.hexadecimal(32),
                dataDecoded: {
                  method: faker.random.word(),
                  parameters: [
                    {
                      name: faker.random.word(),
                      type: faker.random.word(),
                      value: faker.finance.ethereumAddress(),
                    },
                    {
                      name: faker.random.word(),
                      type: faker.random.word(),
                      value: faker.random.numeric(),
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      expect(helper.hasNestedDelegate(dataDecoded)).toBe(true);
    });

    it('should return true if there is one nested DELEGATE operation with no inner dataDecoded', () => {
      const dataDecoded = <DataDecoded>{
        method: faker.random.word(),
        parameters: [
          {
            name: faker.random.word(),
            type: faker.random.word(),
            value: faker.datatype.hexadecimal(32),
            valueDecoded: [
              {
                operation: 1,
                data: faker.datatype.hexadecimal(32),
                dataDecoded: null,
              },
              {
                operation: 0,
                data: faker.datatype.hexadecimal(32),
                dataDecoded: null,
              },
            ],
          },
        ],
      };

      expect(helper.hasNestedDelegate(dataDecoded)).toBe(true);
    });
  });
});
