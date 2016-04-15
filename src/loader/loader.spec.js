import Loader from './loader';

describe('modules', () => {
    let loader;

    beforeEach(() => {
        loader = new Loader();
    });

    it('allows registering a module', () => {
        const myModule = loader.module('myModule', []);
        expect(myModule).toBeDefined();
        expect(myModule.name).toEqual('myModule');
    });

    it('replaces a module when registered with same name again', () => {
        const myModule = loader.module('myModule', []);
        const myNewModule = loader.module('myModule', []);
        expect(myNewModule).not.toBe(myModule);
    });

    it('attaches the requires array to the registered module', () => {
        const myModule = loader.module('myModule', ['myOtherModule']);
        expect(myModule.requires).toEqual(['myOtherModule']);
    });

    it('allows getting a module', () => {
        const myModule = loader.module('myModule', []);
        const gotModule = loader.module('myModule');
        expect(gotModule).toBeDefined();
        expect(gotModule).toBe(myModule);
    });

    it('throws when trying to get a nonexistent module', () => {
        expect(() => {
            loader.module('myModule');
        }).toThrow();
    });
});
