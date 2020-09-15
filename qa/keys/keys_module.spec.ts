describe('keys module', () => {
	describe('When send transaction from a normal account', () => {
		describe('With single valid signature', () => {
			it.todo('should be accepted');
		});

		describe('With multiple valid signatures', () => {
			it.todo('should be rejected');
		});

		describe('With single invalid signature', () => {
			it.todo('should be rejected');
		});

		describe('With no signature', () => {
			it.todo('should be rejected');
		});
	});

	describe('When send transaction from a multi-signature account', () => {
		describe('2 mandatory 2 optional, number of signatures required 3. Mandatory signatures ordered and present; one of the optional signatures present and the other is empty buffer', () => {
			it.todo('should be rejected');
		});

		describe('4 optional, number of signatures required 2. Optional signatures ordered and present', () => {
			it.todo('should be rejected');
		});

		describe('2 mandatory 2 optional, number of signatures required 3. Mandatory signatures out of order', () => {
			it.todo('should be rejected');
		});

		describe('2 mandatory 2 optional, number of signatures required 3. Optional signatures out of order', () => {
			it.todo('should be rejected');
		});

		describe('2 mandatory 2 optional, number of signatures required 3. One mandatory signature missing.', () => {
			it.todo('should be rejected');
		});

		describe('2 mandatory 2 optional, number of signatures required 3. All optional signatures present.', () => {
			it.todo('should be rejected');
		});

		describe('2 mandatory 2 optional, number of signatures required 3. All mandatory signatures present. One optional present. One optional missing (i.e. no empty buffer on its place)', () => {
			it.todo('should be rejected');
		});
	});
});
