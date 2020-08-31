
Feature: DPOS Delegate Registration

  DPOS Delegate Registration

  Background:
    Given A valid account "a" with 20LSK balance

  Scenario Outline: Register username which contains upper case letters
    When Try to register account "a" as delegate with username "<username>"
    Then It should fail with error message "ValidationError: The username is in unsupported format"

    Examples:
      | username   |
      | Delegate   |
      | myDelegate |
      | mydelegatE |

  Scenario Outline: Register username which contains null characters
    When Try to register account "a" as delegate with username "<username>"
    Then It should fail with error message "ValidationError: The username is in unsupported format"

    Examples:
      | username         |
      | myUser\u0000     |
      | \u0000myDelegate |
      | mydel\u0000egatE |

  @ignore
  Scenario Outline: Register username over maximum length 20
    When Try to register account "a" as delegate with username "<username>"
    Then It should fail with error message "Error: Lisk validator found 1 error[s]:\nProperty '.username' should NOT be longer than 20 characters"

    Examples:
      | username                  |
      | perttyprettylongusername1 |
      | 123456789012345678901     |

  @ignore
  Scenario Outline: Register username as empty string
    When Try to register account "a" as delegate with username "<username>"
    Then It should fail with error message "ValidationError: The username is in unsupported format"

    Examples:
      | username |
      |          |

  @only
  Scenario Outline: Register username which have special chracters !@$&_.
    When Try to register account "a" as delegate with username "<username>"
    Then It should be accepted
    And the account "a" should be converted to a delegate with username "<username>"

    Examples:
      | username  |
      | user!     |
      | user@     |
      | user&     |
      | user_     |
      | user.nad  |
      | user.     |
      | user.&df1 |

  Scenario Outline: Register username which have only integers
    When Try to register account "a" as delegate with username "<username>"
    Then It should be accepted
    And the account "a" should be converted to a delegate with username "<username>"

    Examples:
      | username |
      | 12334    |
      | 67899    |

  Scenario: Register username with less than name fee
    When Try to register account "a" as delegate with username "my.delegate" with fee 9LSK
    Then It should be accepted
    Then It should fail with error message "ValidationError: Fee is not compatiable"

  Scenario: Register username with equal to name fee
    When Try to register account "a" as delegate with username "my.delegate" with fee 10LSK
    Then It should be accepted
    And the account "a" should be converted to a delegate with username "my.delegate"

  Scenario: Register duplicate delegate username
    When Try to register account "a" as delegate with username "my.delegate"
    Then It should be accepted
    When Try to register account "a" as delegate with username "my.delegate"
    Then It should fail with error message "Account is already a delegate"

  Scenario: Register an account as delegate which is already a delegate a.k.a try to chagne the username
    When Try to register account "a" as delegate with username "my.delegate"
    Then It should be accepted
    And the account "a" should be converted to a delegate with username "my.delegate"
    Given A valid account "b" with 20LSK balance
    When Try to register account "b" as delegate with username "my.delegate"
    Then It should fail with error message "ValidationError: Username is not unique"

  Scenario: Initialize lastForgedHeight for a delegate account
    When Try to register account "a" as delegate with username "my.delegate"
    Then It should be accepted
    And the account "a" should have lastForgedHeight set to last block height