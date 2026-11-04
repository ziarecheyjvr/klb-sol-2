<?php
// Copy to klb-config.php one level ABOVE public_html and fill in. Never commit the copy.
return [
    'resend_api_key' => 're_xxxxxxxxx',
    'from'           => 'KLB Solutions Website <enquiries@mail.klb-solutions.com>',
    // Inbox for each form option. 'default' catches any option left empty.
    'recipients'     => [
        'default'        => 'inbox@klb-solutions.com',
        'Marketing'      => '',
        'AI · Worldie'   => '',
        'Real Estate'    => '',
        'Commodities'    => '',
        'Something else' => '',
    ],
    'allowed_hosts'  => ['klb-solutions.com', 'www.klb-solutions.com'],
    'auto_reply'     => false,
    'auto_reply_to'  => '',
];
